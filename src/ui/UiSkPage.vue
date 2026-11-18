<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiPage from "./UiPage.vue"
import UiSkRow from "./UiSkRow.vue"

// Общий скелетон страницы для разделов без своего: заголовок, «Загружаем данные…», карточка со строками.
defineProps({
    title: { type: String, required: true },
    rows: { type: Number, default: 6 }
})
</script>

<template>
    <UiPage :title="title" sub="Загружаем…">
        <p class="loading-note" role="status"><span class="spin"></span>Загружаем данные…</p>
        <div class="card" aria-busy="true" style="overflow: hidden"><UiSkRow v-for="i in rows" :key="i" /></div>
    </UiPage>
</template>
