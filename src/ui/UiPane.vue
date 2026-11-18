<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isWide } from "@/composables/useBreakpoint"
import { inject, onBeforeUnmount, watchEffect } from "vue"
import { useRoute } from "vue-router"
import { backTo, pane, paneTarget, PEEK } from "./pane"
import UiIconBtn from "./UiIconBtn.vue"
import UiSheet from "./UiSheet.vue"
import UiSk from "./UiSk.vue"
import UiSkRow from "./UiSkRow.vue"

// Экран-деталь (товар, заказ): от 1180 px — в правой колонке каркаса, 900–1179 — окном по центру, на телефоне — листом снизу.
// Ставится корнем компонента дочернего маршрута раздела. back — куда вернуться при закрытии (обычно адрес раздела);
// открытая через peek() деталь закрывается без смены адреса. loading — скелетон, пока деталь грузится.
// Слоты: default (тело), footer, title, actions.
const props = defineProps({
    title: { type: String, default: "" },
    sub: { type: String, default: "" },
    back: { type: [String, Object], required: true },
    loading: Boolean
})
const route = useRoute()
const peek = inject(PEEK, null)
const close = () => (peek ? peek.close() : backTo(props.back))

pane.details++
pane.close = close
watchEffect(() => (pane.key = peek ? peek.key : route.path))
onBeforeUnmount(() => {
    pane.details--
    if (pane.close === close) pane.close = null
    if (!pane.details) pane.key = ""
})
</script>

<template>
    <Teleport v-if="isWide && paneTarget" :to="paneTarget">
        <header class="ov__head">
            <div class="ov__ht">
                <h2>
                    <slot name="title">{{ title }}</slot>
                </h2>
                <p v-if="sub">{{ sub }}</p>
            </div>
            <slot name="actions" />
            <UiIconBtn icon="x" label="Закрыть" class="ov__x" @click="close" />
        </header>
        <div class="ov__body">
            <div v-if="loading" class="panesk" aria-busy="true"><UiSk w="46%" :h="28" :r="99" /><UiSk w="82%" :h="22" /><UiSk w="64%" /><UiSkRow v-for="i in 4" :key="i" /></div>
            <slot v-else />
        </div>
        <footer v-if="$slots.footer && !loading" class="ov__foot"><slot name="footer" /></footer>
    </Teleport>
    <UiSheet v-else :title="title" :sub="sub" size="lg" cls="ov--pane" @close="close">
        <template v-if="$slots.title" #title><slot name="title" /></template>
        <template v-if="$slots.actions" #actions><slot name="actions" /></template>
        <div v-if="loading" class="panesk" aria-busy="true"><UiSk w="46%" :h="28" :r="99" /><UiSk w="82%" :h="22" /><UiSk w="64%" /><UiSkRow v-for="i in 4" :key="i" /></div>
        <slot v-else />
        <template v-if="$slots.footer && !loading" #footer><slot name="footer" /></template>
    </UiSheet>
</template>
