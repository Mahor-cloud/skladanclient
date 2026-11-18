<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { computed } from "vue"
import { hash } from "@/domain/format"

// Кружок с инициалами; цвет постоянен для пользователя. user: { _id, name }.
const props = defineProps({
    user: { type: Object, default: null },
    size: { type: String, default: "md" }
})
const HUES = ["#0147B9", "#0E8F80", "#E8902B", "#2B6DE0", "#A23B72", "#1FA463", "#D9534F", "#4F6D8F"]
const name = computed(() => props.user?.name || "?")
const initials = computed(() =>
    name.value
        .replace(/[«»"(].*$/, "")
        .split(/[\s-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
)
</script>

<template>
    <span class="avatar" :class="'avatar--' + size" :style="{ '--av': HUES[hash(user?._id || name) % HUES.length] }" aria-hidden="true">{{ initials }}</span>
</template>
