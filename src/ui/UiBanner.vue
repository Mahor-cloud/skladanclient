<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiIcon from "./UiIcon.vue"

// tone: info | warning | danger | success | teal | primary | neutral. Слот action — кнопка справа.
defineProps({
    tone: { type: String, default: "info" },
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    text: { type: String, default: "" }
})
const ICONS = { danger: "alert", warning: "alert", success: "check", info: "info", teal: "refund" }
</script>

<template>
    <div class="banner" :class="'banner--' + tone" :role="tone === 'danger' ? 'alert' : 'status'">
        <UiIcon :name="icon || ICONS[tone] || 'info'" :size="22" class="banner__i" />
        <div class="banner__body">
            <b v-if="title">{{ title }}</b>
            <p v-if="text || $slots.default">
                <slot>{{ text }}</slot>
            </p>
        </div>
        <slot name="action" />
    </div>
</template>
