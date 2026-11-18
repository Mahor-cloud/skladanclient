<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
// Пустое состояние с рисунком. art: box | search | error. Слот — кнопки действий.
defineProps({
    art: { type: String, default: "box" },
    title: { type: String, required: true },
    text: { type: String, default: "" }
})
const TAGS = [
    [92, "#CFC06A", -18],
    [108, "#3F7F63", 6],
    [124, "#0147B9", 22]
]
</script>

<template>
    <div class="empty">
        <svg v-if="art === 'error'" class="empty__art" viewBox="0 0 160 110" aria-hidden="true">
            <ellipse cx="80" cy="100" rx="56" ry="6" fill="currentColor" opacity=".08" />
            <path d="M38 40h84v52H38z" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="2" />
            <path d="M38 40l14-16h56l14 16" fill="none" stroke="var(--line-strong)" stroke-width="2" />
            <path d="M70 58l20 20M90 58 70 78" stroke="var(--danger)" stroke-width="5" stroke-linecap="round" />
        </svg>
        <svg v-else-if="art === 'search'" class="empty__art" viewBox="0 0 160 110" aria-hidden="true">
            <ellipse cx="80" cy="100" rx="56" ry="6" fill="currentColor" opacity=".08" />
            <circle cx="72" cy="50" r="28" fill="var(--surface)" stroke="var(--primary)" stroke-width="6" />
            <path d="m93 72 18 18" stroke="var(--primary)" stroke-width="9" stroke-linecap="round" />
            <path d="M62 50h20" stroke="var(--line-strong)" stroke-width="5" stroke-linecap="round" />
        </svg>
        <svg v-else class="empty__art" viewBox="0 0 160 110" aria-hidden="true">
            <ellipse cx="80" cy="100" rx="58" ry="6" fill="currentColor" opacity=".08" />
            <path d="M34 50 80 34l46 16v42L80 104 34 92z" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="2" stroke-linejoin="round" />
            <path d="M34 50 80 66l46-16M80 66v38" fill="none" stroke="var(--line-strong)" stroke-width="2" />
            <path d="M34 50 18 64l46 16 16-14z" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2" stroke-linejoin="round" />
            <g v-for="[x, c, r] in TAGS" :key="x" :transform="`rotate(${r} ${x + 9} 40)`">
                <circle :cx="x + 9" cy="12" r="6" fill="none" stroke="#B7BCC7" stroke-width="2" />
                <rect :x="x" y="16" width="18" height="36" rx="8" :fill="c" />
                <circle :cx="x + 9" cy="22" r="2" fill="var(--surface)" />
            </g>
        </svg>
        <h3>{{ title }}</h3>
        <p v-if="text">{{ text }}</p>
        <div v-if="$slots.default" class="empty__act"><slot /></div>
    </div>
</template>
