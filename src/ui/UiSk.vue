<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
// Полоска-скелетон: <UiSk w="46%" :h="20" />
defineProps({
    w: { type: String, default: "100%" },
    h: { type: Number, default: 14 },
    r: { type: Number, default: 6 }
})
</script>

<template>
    <span class="sk" :style="{ width: w, height: h + 'px', borderRadius: r + 'px' }"></span>
</template>
