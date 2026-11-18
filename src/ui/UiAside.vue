<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isWide } from "@/composables/useBreakpoint"
import { computed, onBeforeUnmount, watchEffect } from "vue"
import { pane, paneTarget } from "./pane"

// Правая колонка раздела по умолчанию (корзина, «Сейчас важно»): видна только от 1180 px и пока её не заняла деталь (UiPane).
// Ставится в шаблон страницы раздела; уже 1180 px не рисует ничего. name попадает в <div id="app" data-pane="…">.
// Слоты: default (тело), footer, title.
const props = defineProps({
    name: { type: String, required: true },
    title: { type: String, default: "" },
    sub: { type: String, default: "" }
})
const shown = computed(() => isWide.value && !!paneTarget.value && !pane.details)
pane.aside = props.name
watchEffect(() => (pane.asideShown = shown.value))
onBeforeUnmount(() => {
    if (pane.aside === props.name) pane.aside = ""
    pane.asideShown = false
})
</script>

<template>
    <Teleport v-if="shown" :to="paneTarget">
        <header class="ov__head">
            <div class="ov__ht">
                <h2>
                    <slot name="title">{{ title }}</slot>
                </h2>
                <p v-if="sub">{{ sub }}</p>
            </div>
        </header>
        <div class="ov__body"><slot /></div>
        <footer v-if="$slots.footer" class="ov__foot"><slot name="footer" /></footer>
    </Teleport>
</template>
