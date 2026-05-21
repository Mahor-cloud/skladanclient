<script setup>
import { computed } from "vue"

const props = defineProps({

    status: { type: String, required: true },

    kind: { type: String, default: "order" },

    icon: { type: String, default: "" },

    size: { type: String, default: "sm" }
})

const variantClass = computed(() => {
    const s = (props.status || "").toLowerCase()
    if (s.includes("заверш") && !s.includes("частично")) return "status-pill--done"
    if (s.includes("частично")) return "status-pill--partial"
    if (s.includes("к выдач") || s.includes("получен")) return "status-pill--ready"
    if (s.includes("оплач") || s.includes("ожидан")) return "status-pill--pending"
    if (s.includes("новый")) return "status-pill--draft"
    return "status-pill--draft"
})
</script>

<template>
    <span class="status-pill" :class="[variantClass, size === 'md' ? 'status-pill--md' : '']">
        <i v-if="icon" :class="['pi', `pi-${icon}`]"></i>
        <span>{{ status }}</span>
    </span>
</template>

<style scoped>
.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
    border: 1px solid transparent;
}
.status-pill--md {
    padding: 4px 12px;
    font-size: 14px;
}

.status-pill--draft {
    background: rgba(100, 116, 139, 0.12);
    color: #334155;
    border-color: rgba(100, 116, 139, 0.24);
}
.status-pill--pending {
    background: rgba(14, 165, 233, 0.12);
    color: #075985;
    border-color: rgba(14, 165, 233, 0.24);
}
.status-pill--ready {
    background: rgba(16, 185, 129, 0.12);
    color: #065f46;
    border-color: rgba(16, 185, 129, 0.24);
}
.status-pill--partial {
    background: rgba(245, 158, 11, 0.12);
    color: #92400e;
    border-color: rgba(245, 158, 11, 0.24);
}
.status-pill--done {
    background: rgba(34, 197, 94, 0.12);
    color: #166534;
    border-color: rgba(34, 197, 94, 0.24);
}
:global(.app-dark) .status-pill--draft {
    background: rgba(148, 163, 184, 0.16);
    color: #cbd5e1;
}
:global(.app-dark) .status-pill--pending {
    background: rgba(56, 189, 248, 0.16);
    color: #7dd3fc;
}
:global(.app-dark) .status-pill--ready {
    background: rgba(52, 211, 153, 0.16);
    color: #6ee7b7;
}
:global(.app-dark) .status-pill--partial {
    background: rgba(251, 191, 36, 0.16);
    color: #fcd34d;
}
:global(.app-dark) .status-pill--done {
    background: rgba(74, 222, 128, 0.16);
    color: #86efac;
}
</style>
