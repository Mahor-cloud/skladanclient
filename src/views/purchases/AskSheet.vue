<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { UiBtn, UiIcon, UiSheet } from "@/ui"

// Подтверждение с дополнительным содержимым (суммы, плашка черновика, текст с выделением): разметка как у confirm() основы,
// в котором такого слота нет. Событие done(true | false) — после анимации закрытия.
defineProps({
    title: { type: String, required: true },
    text: { type: String, default: "" },
    tone: { type: String, default: "primary" },
    icon: { type: String, default: "" },
    ok: { type: String, default: "Да" },
    okIcon: { type: String, default: "" },
    cancel: { type: String, default: "Отмена" }
})
const emit = defineEmits(["done"])
</script>

<template>
    <UiSheet :label="title" size="sm" cls="ov--confirm" @close="emit('done', $event === 'ok')">
        <div class="confirm" :class="'confirm--' + tone">
            <span class="confirm__i"><UiIcon :name="icon || (tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : 'info')" :size="26" /></span>
            <div class="confirm__t">
                <h3>{{ title }}</h3>
                <p v-if="text || $slots.text">
                    <slot name="text">{{ text }}</slot>
                </p>
            </div>
        </div>
        <slot />
        <template #footer="{ close }">
            <UiBtn :label="cancel" kind="secondary" size="lg" @click="close('cancel')" />
            <UiBtn :label="ok" :kind="tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'primary'" :icon="okIcon" size="lg" @click="close('ok')" />
        </template>
    </UiSheet>
</template>
