<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { onMounted, ref } from "vue"

// Штамп: tone — paid | ready | done. fresh — только что поставлен: ложится «ударом» (при «уменьшить движение» просто виден).
const props = defineProps({
    text: { type: String, default: "" },
    tone: { type: String, required: true },
    date: { type: String, default: "" },
    rot: { type: Number, default: -6 },
    fresh: Boolean
})
const el = ref(null)
onMounted(() => {
    if (!props.fresh || !el.value.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    el.value.animate(
        [
            { transform: `rotate(${props.rot + 14}deg) scale(2.5)`, opacity: 0, filter: "blur(3px)" },
            { transform: `rotate(${props.rot}deg) scale(1)`, opacity: 1, filter: "blur(0)" }
        ],
        { duration: 440, easing: "cubic-bezier(.34, 1.56, .64, 1)" }
    )
    el.value.closest(".card")?.animate([{ transform: "translateY(0)" }, { transform: "translateY(3px)" }, { transform: "translateY(0)" }], { duration: 140, delay: 190 })
    try {
        navigator.vibrate?.(16)
    } catch {
        // вибрация недоступна — штамп просто ложится
    }
})
</script>

<template>
    <span ref="el" class="stamp" :class="'stamp--' + tone" :style="{ '--rot': rot + 'deg' }">
        <b
            ><slot>{{ text }}</slot></b
        ><small v-if="date">{{ date }}</small>
    </span>
</template>
