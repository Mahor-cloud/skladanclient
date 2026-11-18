<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { backTo, UiBtn, UiIcon, UiSheet } from "@/ui"
import { computed } from "vue"
import { HELP } from "./metrics"

// Справка по метрике — окно по адресу /observability/help/:k.
const props = defineProps({ k: { type: String, required: true } })
const help = computed(() => HELP[props.k] || HELP.rss)
</script>

<template>
    <UiSheet :title="help[0]" size="sm" @close="backTo({ name: 'observability' })">
        <div class="helptext">
            <UiIcon name="pulse" :size="24" />
            <p style="white-space: pre-line">{{ help[1] }}</p>
        </div>
        <template #footer="{ close }"><UiBtn label="Понятно" kind="secondary" size="lg" @click="close()" /></template>
    </UiSheet>
</template>
