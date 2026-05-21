<script setup>
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { useQuery } from "@tanstack/vue-query"
import { computed, ref } from "vue"

const filter = ref("")
const typeFilter = ref(null)
const page = ref(1)
const pageSize = ref(50)
const periodMode = ref("all")
const customFrom = ref(null)
const customTo = ref(null)

const periodOptions = [
    { label: "Всё время", value: "all" },
    { label: "День", value: "day" },
    { label: "Неделя", value: "week" },
    { label: "Месяц", value: "month" },
    { label: "Произвольно", value: "custom" }
]

function computePeriod() {
    const now = Date.now()
    const day = 24 * 3600 * 1000
    switch (periodMode.value) {
        case "day": return { from: now - day, to: now }
        case "week": return { from: now - 7 * day, to: now }
        case "month": return { from: now - 30 * day, to: now }
        case "custom":
            return {
                from: customFrom.value ? new Date(customFrom.value).getTime() : undefined,
                to: customTo.value ? new Date(customTo.value).getTime() + day : undefined
            }
        default: return { from: undefined, to: undefined }
    }
}

const EVENT_LABELS_RU = {
    "order-created": "Заказ создан",
    "order-updated": "Заказ обновлён",
    "order-deleted": "Заказ удалён",
    "order-surcharge-pending": "Требуется доплата",
    "order-refund-pending": "Требуется возврат",
    "purchase-created": "Закупка создана",
    "purchase-updated": "Закупка обновлена",
    "purchase-deleted": "Закупка удалена",
    "inventory-created": "Инвентаризация начата",
    "inventory-updated": "Инвентаризация обновлена",
    "inventory-edited-after-completion": "Завершённая инвентаризация переписана",
    "inventory-deleted": "Инвентаризация удалена",
    "inventory-deleted-after-completion": "Завершённая инвентаризация удалена",
    "product-created": "Товар создан",
    "product-updated": "Товар обновлён",
    "product-deleted": "Товар удалён",
    "user-created": "Пользователь создан",
    "user-updated": "Пользователь обновлён",
    "user-deleted": "Пользователь удалён",
    "role-created": "Роль создана",
    "role-updated": "Роль обновлена",
    "role-deleted": "Роль удалена"
}

function eventLabel(type) {
    return EVENT_LABELS_RU[type] || type
}

const queryParams = computed(() => {
    const p = computePeriod()
    const params = new URLSearchParams()
    params.set("page", String(page.value))
    params.set("limit", String(pageSize.value))
    if (p.from != null) params.set("from", String(p.from))
    if (p.to != null) params.set("to", String(p.to))
    return params.toString()
})

const { data, isSuccess, isFetching } = useQuery({
    queryKey: computed(() => ["history", queryParams.value]),
    queryFn: async () => await axiosInstance.get(`/change-history?${queryParams.value}`),

    select: (data) => data.data,
    staleTime: 1000 * 60 * 5
})

const items = computed(() => data.value?.items || [])
const total = computed(() => data.value?.total || 0)
const totalPages = computed(() => data.value?.pages || 1)

const typeOptions = computed(() => {
    if (!items.value) return []
    const set = new Set(items.value.map((i) => i.changeType).filter(Boolean))
    return Array.from(set).sort().map((t) => ({ label: eventLabel(t), value: t }))
})

const filtered = computed(() => {
    const list = items.value
    const q = filter.value.trim().toLowerCase()
    return list.filter((i) => {
        if (typeFilter.value && i.changeType !== typeFilter.value) return false
        if (!q) return true
        const hay = `${i.user?.name || ""} ${i.changeType || ""} ${i.description || ""}`.toLowerCase()
        return hay.includes(q)
    })
})

const groups = computed(() => {
    const map = new Map()
    for (const item of filtered.value) {
        const date = new Date(item.changeDate)
        const dayKey = date.toISOString().slice(0, 10)
        if (!map.has(dayKey)) map.set(dayKey, { dayLabel: formatDayLabel(date), items: [] })
        map.get(dayKey).items.push(item)
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }))
})

function formatDayLabel(date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)
    const diff = Math.round((today - target) / (24 * 3600 * 1000))
    if (diff === 0) return "Сегодня"
    if (diff === 1) return "Вчера"
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

function shortTime(d) {
    return new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

function typeColor(type) {
    if (!type) return "slate"
    const t = type.toLowerCase()
    if (t.includes("delete") || t.includes("удал")) return "red"
    if (t.includes("create") || t.includes("созда")) return "emerald"
    if (t.includes("update") || t.includes("измен")) return "sky"
    if (t.includes("pay") || t.includes("оплат")) return "amber"
    return "slate"
}
</script>

<template>
    <div class="card history-page">
        <header class="history-header">
            <h1 class="history-title">История изменений</h1>
            <div class="history-controls">
                <SelectButton v-model="periodMode" :options="periodOptions" optionLabel="label" optionValue="value" @change="page = 1" />
                <div v-if="periodMode === 'custom'" class="flex gap-2 items-center">
                    <DatePicker v-model="customFrom" placeholder="С" dateFormat="dd.mm.yy" showButtonBar />
                    <DatePicker v-model="customTo" placeholder="По" dateFormat="dd.mm.yy" showButtonBar />
                </div>
                <IconField>
                    <InputIcon><i class="pi pi-search"></i></InputIcon>
                    <InputText v-model="filter" placeholder="Поиск..." />
                </IconField>
                <Select v-model="typeFilter" :options="typeOptions" optionLabel="label" optionValue="value" placeholder="Все типы" showClear />
            </div>
        </header>

        <div v-if="!isSuccess" class="timeline">
            <div v-for="dayIdx in 2" :key="'day-sk-' + dayIdx" class="timeline-group">
                <Skeleton width="6rem" height="1rem" class="mb-2" />
                <div class="timeline-items">
                    <div v-for="i in 4" :key="'sk-' + dayIdx + '-' + i" class="timeline-row">
                        <div class="timeline-axis">
                            <Skeleton shape="circle" size="12px" />
                        </div>
                        <div class="timeline-content" style="flex: 1">
                            <Skeleton width="40%" height="1rem" class="mb-1" />
                            <Skeleton width="80%" height="0.85rem" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="filtered.length === 0" class="empty-state">
            <i class="pi pi-inbox"></i>
            <div>Нет записей</div>
        </div>

        <div v-else class="timeline">
            <div v-for="group in groups" :key="group.key" class="timeline-group">
                <div class="timeline-day">{{ group.dayLabel }}</div>
                <div class="timeline-items">
                    <div v-for="item in group.items" :key="item._id" class="timeline-row">
                        <div class="timeline-axis">
                            <span class="timeline-dot" :class="`timeline-dot--${typeColor(item.changeType)}`"></span>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-meta">
                                <span class="timeline-time">{{ shortTime(item.changeDate) }}</span>
                                <span v-if="item.user?.name" class="timeline-user">{{ item.user.name }}</span>
                                <span class="timeline-type" :class="`timeline-type--${typeColor(item.changeType)}`">{{ eventLabel(item.changeType) }}</span>
                            </div>
                            <p class="timeline-desc">{{ item.description }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="isSuccess && total > 0" class="history-pager">
            <div class="text-sm opacity-75">Всего: {{ total }} записей · стр. {{ page }} / {{ totalPages }}</div>
            <div class="flex gap-2 items-center">
                <Button icon="pi pi-chevron-left" aria-label="Предыдущая страница" size="small" outlined :disabled="page <= 1" @click="page = page - 1" />
                <Button icon="pi pi-chevron-right" aria-label="Следующая страница" size="small" outlined :disabled="page >= totalPages" @click="page = page + 1" />
                <Select v-model="pageSize" :options="[25, 50, 100, 200]" @change="page = 1" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.history-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
}
.history-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
}
.history-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 16px;
    gap: 8px;
    opacity: 0.7;
}
.empty-state i {
    font-size: 28px;
}
.timeline {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.timeline-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.timeline-day {
    font-weight: 600;
    font-size: 0.95rem;
    padding-bottom: 4px;
    border-bottom: 1px dashed var(--p-content-border-color, rgba(0, 0, 0, 0.12));
}
.timeline-items {
    display: flex;
    flex-direction: column;
    gap: 0;
}
.timeline-row {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 8px;
}
.timeline-axis {
    position: relative;
    display: flex;
    justify-content: center;
}
.timeline-axis::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--p-content-border-color, rgba(0, 0, 0, 0.1));
}
.timeline-row:first-child .timeline-axis::before {
    top: 12px;
}
.timeline-row:last-child .timeline-axis::before {
    bottom: calc(100% - 12px);
}
.timeline-dot {
    position: relative;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-top: 8px;
    z-index: 1;
    box-shadow: 0 0 0 3px var(--p-content-background, #ffffff);
}
.timeline-dot--slate { background: #94a3b8; }
.timeline-dot--red { background: #ef4444; }
.timeline-dot--emerald { background: #10b981; }
.timeline-dot--sky { background: #0ea5e9; }
.timeline-dot--amber { background: #f59e0b; }
.timeline-content {
    padding: 4px 0 16px;
}
.timeline-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 0.85rem;
}
.timeline-time {
    font-weight: 600;
    min-width: 44px;
}
.timeline-user {
    opacity: 0.85;
}
.timeline-type {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 1px 8px;
    border-radius: 999px;
    letter-spacing: 0.02em;
}
.timeline-type--slate { background: rgba(148, 163, 184, 0.16); color: #475569; }
.timeline-type--red { background: rgba(239, 68, 68, 0.14); color: #b91c1c; }
.timeline-type--emerald { background: rgba(16, 185, 129, 0.14); color: #047857; }
.timeline-type--sky { background: rgba(14, 165, 233, 0.14); color: #0369a1; }
.timeline-type--amber { background: rgba(245, 158, 11, 0.14); color: #b45309; }
.timeline-desc {
    margin: 4px 0 0;
    font-size: 0.92rem;
    line-height: 1.45;
    word-break: break-word;
}
:global(.app-dark) .timeline-type--slate { color: #cbd5e1; background: rgba(148, 163, 184, 0.2); }
:global(.app-dark) .timeline-type--red { color: #fca5a5; }
:global(.app-dark) .timeline-type--emerald { color: #6ee7b7; }
:global(.app-dark) .timeline-type--sky { color: #7dd3fc; }
:global(.app-dark) .timeline-type--amber { color: #fcd34d; }
.history-pager {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--p-content-border-color, rgba(0, 0, 0, 0.12));
}
@media (max-width: 480px) {
    .history-controls {
        width: 100%;
    }
    .history-controls > * {
        flex: 1;
    }
    .history-pager {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
