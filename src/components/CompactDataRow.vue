<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
defineProps({
    onClick: { type: Function, default: null }
})
</script>

<template>
    <div class="compact-data-row" :class="{ 'compact-data-row--clickable': $attrs.onClick }" v-bind="$attrs">
        <div class="compact-data-row__header">
            <slot name="header"></slot>
        </div>
        <div class="compact-data-row__body">
            <slot></slot>
        </div>
        <div v-if="$slots.action" class="compact-data-row__action">
            <slot name="action"></slot>
        </div>
    </div>
</template>

<style scoped>
.compact-data-row {
    background: var(--p-content-background, #ffffff);
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: background 120ms ease-out, border-color 120ms ease-out;
}
.compact-data-row--clickable {
    cursor: pointer;
}
.compact-data-row--clickable:hover {
    background: var(--p-content-hover-background, #f4f4f5);
}
.compact-data-row__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-weight: 600;
}
.compact-data-row__body {
    font-size: 14px;
    line-height: 1.45;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.compact-data-row__action {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
}
</style>
