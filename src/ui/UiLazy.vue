<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import UiSkRow from "./UiSkRow.vue"

// Длинный список порциями: первые size строк сразу, следующие — когда сторож (скелетоны) подходит к экрану.
// Слот по умолчанию получает { item, index }; слот sk — свои скелетоны сторожа. Смена resetKey возвращает к первой порции.
const props = defineProps({
    items: { type: Array, required: true },
    size: { type: Number, default: 20 },
    resetKey: { type: [String, Number], default: "" }
})
const shown = ref(props.size)
watch(
    () => props.resetKey,
    () => (shown.value = props.size)
)
const list = computed(() => props.items.slice(0, shown.value))
const guard = ref(null)
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (shown.value += props.size), { rootMargin: "240px" }) : null
// У сторожа display: contents — наблюдаем его первый скелетон; после каждой порции заново: вдруг он всё ещё на экране.
watch(
    [guard, shown],
    () => {
        if (!io) return (shown.value = Infinity)
        io.disconnect()
        if (guard.value?.firstElementChild) io.observe(guard.value.firstElementChild)
    },
    { flush: "post" }
)
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
    <slot v-for="(item, index) in list" :key="item._id ?? index" :item="item" :index="index" />
    <div v-if="shown < items.length" ref="guard" class="lazy" aria-hidden="true">
        <slot name="sk"><UiSkRow /><UiSkRow /></slot>
    </div>
</template>
