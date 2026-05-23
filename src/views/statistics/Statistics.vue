<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import StatusPill from "@/components/StatusPill.vue"
import { useCurrentUser } from "@/composables/useCurrentUser"
import { useLayout } from "@/layout/composables/layout"
import axiosInstance from "@/service/axios"
import OrderDialog from "@/views/shop/OrderDialog.vue"
import { useQuery } from "@tanstack/vue-query"
import { computed, ref, watch } from "vue"

const { isDarkTheme } = useLayout()

const user = useCurrentUser()

const _now = Date.now()
const _fallbackStart = new Date(2020, 0, 1).getTime()
const customFrom = ref(new Date(_fallbackStart))
const customTo = ref(new Date(_now))
let _boundsApplied = false
;(async () => {
    try {
        const { data } = await axiosInstance.get("/statistics/period-bounds")

        if (!_boundsApplied && data?.from) {
            customFrom.value = new Date(data.from)
        }
        _boundsApplied = true
    } catch {

    }
})()
const selectedUsers = ref([])
const selectedProducts = ref([])

const range = computed(() => {
    const now = Date.now()
    const allTimeStart = new Date(2020, 0, 1).getTime()
    return {
        from: customFrom.value ? new Date(customFrom.value).getTime() : allTimeStart,
        to: customTo.value ? new Date(customTo.value).getTime() : now
    }
})

const queryString = computed(() => {
    const params = new URLSearchParams()
    params.set("from", String(range.value.from))
    params.set("to", String(range.value.to))
    if (selectedUsers.value.length) params.set("users", selectedUsers.value.join(","))
    if (selectedProducts.value.length) params.set("products", selectedProducts.value.join(","))
    return params.toString()
})

const appliedQueryString = ref(queryString.value)
const appliedSelectedProducts = ref([...selectedProducts.value])
const appliedSelectedUsers = ref([...selectedUsers.value])
const filtersDirty = computed(() => appliedQueryString.value !== queryString.value)

const showFlowCharts = computed(() => appliedSelectedUsers.value.length === 0)

function applyFilters() {
    appliedQueryString.value = queryString.value
    appliedSelectedProducts.value = [...selectedProducts.value]
    appliedSelectedUsers.value = [...selectedUsers.value]
}

function formatDateLabel(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return dateStr
    const parts = dateStr.split("-")
    if (parts.length !== 3) return dateStr
    return `${parts[2]}.${parts[1]}.${parts[0]}`
}

const orderInfoVisible = ref(false)
const orderInfoId = ref(null)
function openOrderInfo(id) {
    orderInfoId.value = id
    orderInfoVisible.value = true
}

const queryKey = computed(() => ["statistics", "dashboard", appliedQueryString.value])

const { data, isFetching, isSuccess, refetch } = useQuery({
    queryKey,
    queryFn: async () =>
        (await axiosInstance.get(`/statistics/dashboard?${appliedQueryString.value}`)).data,
    staleTime: 30_000,
    placeholderData: (previous) => previous,

    retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
    }
})

const { data: usersList, isSuccess: isUsersSuccess } = useQuery({
    queryKey: ["users-for-statistics"],
    queryFn: async () => (await axiosInstance.get("/auth/users")).data,
    staleTime: 60_000
})

const { data: productsList, isSuccess: isProductsSuccess } = useQuery({
    queryKey: ["products-for-statistics"],
    queryFn: async () => (await axiosInstance.get("/products?includeDeleted=true")).data,
    staleTime: 60_000
})

const userOptions = computed(() =>
    (usersList.value || [])
        .filter((u) => Array.isArray(u.role?.permissions) && u.role.permissions.includes("create_orders"))
        .map((u) => ({ label: u.name || u.login, value: u._id }))
)
const productOptions = computed(() => (productsList.value || []).map((p) => ({ label: p.name, value: p._id })))

function formatRub(value) {
    if (value === undefined || value === null) return "—"
    return Number(value).toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDate(ts) {
    return new Date(ts).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
}

const colors = {
    primary: "#0ea5e9",
    primaryFill: "rgba(14, 165, 233, 0.4)",
    success: "#10b981",
    successFill: "rgba(16, 185, 129, 0.4)",
    palette: ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#f43f5e", "#6366f1", "#84cc16", "#06b6d4"]
}

const barLabelsPlugin = {
    id: "barInlineLabels",
    afterDatasetsDraw(chart) {
        const isHorizontal = chart.options?.indexAxis === "y"
        if (!isHorizontal) return
        const ctx = chart.ctx
        ctx.save()
        ctx.font = "600 11px sans-serif"
        chart.data.datasets.forEach((dataset, dsIdx) => {
            const meta = chart.getDatasetMeta(dsIdx)
            meta.data.forEach((element, idx) => {
                const value = dataset.data[idx]
                if (value === null || value === undefined) return
                const props = element.getProps(["x", "y", "base"], true)
                const text = String(value)
                const textWidth = ctx.measureText(text).width
                const barWidth = Math.abs(props.x - props.base)
                if (barWidth > textWidth + 12) {

                    ctx.fillStyle = "#ffffff"
                    ctx.textAlign = "right"
                    ctx.textBaseline = "middle"
                    ctx.fillText(text, props.x - 6, props.y)
                } else {

                    ctx.fillStyle = isDarkTheme.value ? "#cbd5e1" : "#475569"
                    ctx.textAlign = "left"
                    ctx.textBaseline = "middle"
                    ctx.fillText(text, props.x + 6, props.y)
                }
            })
        })
        ctx.restore()
    }
}
const chartPlugins = [barLabelsPlugin]

const ordersByDayChart = computed(() => {
    const rows = data.value?.charts?.ordersByDay || []
    return {
        labels: rows.map((r) => r.date),
        datasets: [
            {
                label: "Заказов",
                data: rows.map((r) => r.ordersCount),
                backgroundColor: colors.primaryFill,
                borderColor: colors.primary,
                borderWidth: 1
            },
            {
                label: "Завершено",
                data: rows.map((r) => r.completedCount),
                backgroundColor: colors.successFill,
                borderColor: colors.success,
                borderWidth: 1
            }
        ]
    }
})

const turnoverByDayChart = computed(() => {
    const rows = data.value?.charts?.ordersByDay || []
    return {
        labels: rows.map((r) => formatDateLabel(r.date)),
        datasets: [
            {
                label: "Сумма заказов (₽)",
                data: rows.map((r) => r.amount),
                backgroundColor: "rgba(14, 165, 233, 0.18)",
                borderColor: colors.primary,
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 2
            }
        ]
    }
})

const flowChart = computed(() => {
    const orders = data.value?.charts?.ordersByDay || []
    const purchases = data.value?.charts?.purchasesByDay || []
    const dateSet = new Set([...orders.map((r) => r.date), ...purchases.map((r) => r.date)])
    const dates = Array.from(dateSet).sort()
    const ordersMap = new Map(orders.map((r) => [r.date, r.amount]))
    const purchasesMap = new Map(purchases.map((r) => [r.date, r.amount]))
    return {
        labels: dates.map(formatDateLabel),
        datasets: [
            {
                label: "Продажи (₽)",
                data: dates.map((d) => ordersMap.get(d) || 0),
                backgroundColor: "rgba(239, 68, 68, 0.16)",
                borderColor: "#ef4444",
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3
            },
            {
                label: "Поступления (₽)",
                data: dates.map((d) => purchasesMap.get(d) || 0),
                backgroundColor: "rgba(16, 185, 129, 0.16)",
                borderColor: "#10b981",
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }
        ]
    }
})

const flowTotals = computed(() => {
    const orders = (data.value?.charts?.ordersByDay || []).reduce((a, r) => a + (r.amount || 0), 0)
    const purchases = (data.value?.charts?.purchasesByDay || []).reduce((a, r) => a + (r.amount || 0), 0)
    return { orders, purchases, balance: purchases - orders }
})

const flowByProductRows = computed(() => {
    const flow = data.value?.charts?.flowByProduct || []
    const flowMap = new Map(flow.map((r) => [String(r.productId), r]))
    const all = productsList.value || []
    const filterIds = appliedSelectedProducts.value
    const merged = all
        .filter((p) => filterIds.length === 0 || filterIds.includes(String(p._id)))
        .map((p) => {
            const existing = flowMap.get(String(p._id))
            if (existing) return existing
            return {
                productId: String(p._id),
                name: p.name,
                category: p.category,
                received: 0,
                sold: 0,
                gap: 0
            }
        })
    return merged.sort((a, b) => {
        const d = Math.abs(b.gap || 0) - Math.abs(a.gap || 0)
        if (d !== 0) return d
        return (a.name || "").localeCompare(b.name || "", "ru")
    })
})

function gapClass(gap) {
    if (!gap) return "gap--zero"
    if (gap > 0) return "gap--positive"
    return "gap--negative"
}

function paletteAt(i) {
    return colors.palette[i % colors.palette.length]
}

const BAR_HEIGHT_PX = 14
const ROW_GAP_PX = 10

const MIN_CHART_HEIGHT = 220

function chartHeightFor(rows) {
    const n = Array.isArray(rows) ? rows.length : 0
    const computed = n * (BAR_HEIGHT_PX + ROW_GAP_PX) + 60
    return Math.max(MIN_CHART_HEIGHT, computed)
}

function zeroFillProducts(soldRows, sortKey) {
    const all = productsList.value || []
    const filterIds = appliedSelectedProducts.value
    const soldMap = new Map((soldRows || []).map((r) => [String(r.productId), r]))
    const allRows = all
        .filter((p) => filterIds.length === 0 || filterIds.includes(String(p._id)))
        .map((p) => {
            const s = soldMap.get(String(p._id))
            if (s) return s
            return {
                productId: String(p._id),
                name: p.name,
                category: p.category,
                amount: 0,
                quantity: 0,
            }
        })
    return allRows.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
}

const topProductsChart = computed(() => {
    const rows = zeroFillProducts(data.value?.charts?.topProducts, "amount")
    return {
        labels: rows.map((r) => r.name || "—"),
        datasets: [
            {
                label: "Сумма (₽)",
                data: rows.map((r) => r.amount),
                backgroundColor: rows.map((_, i) => paletteAt(i)),
                borderColor: rows.map((_, i) => paletteAt(i)),
                borderWidth: 0,
                barThickness: BAR_HEIGHT_PX
            }
        ]
    }
})

const topProductsByQuantityChart = computed(() => {
    const rows = zeroFillProducts(data.value?.charts?.topProductsByQuantity, "quantity")
    return {
        labels: rows.map((r) => r.name || "—"),
        datasets: [
            {
                label: "Кол-во (шт)",
                data: rows.map((r) => r.quantity),
                backgroundColor: rows.map((_, i) => paletteAt(i)),
                borderColor: rows.map((_, i) => paletteAt(i)),
                borderWidth: 0,
                barThickness: BAR_HEIGHT_PX
            }
        ]
    }
})

const topUsersChart = computed(() => {
    const rows = data.value?.charts?.topUsers || []
    return {
        labels: rows.map((r) => r.name || "—"),
        datasets: [
            {
                label: "Сумма (₽)",
                data: rows.map((r) => r.amount),
                backgroundColor: rows.map((_, i) => paletteAt(i)),
                borderColor: rows.map((_, i) => paletteAt(i)),
                borderWidth: 0,
                barThickness: BAR_HEIGHT_PX
            }
        ]
    }
})

const topProductsHeight = computed(() => chartHeightFor(topProductsChart.value.labels))
const topProductsByQuantityHeight = computed(() => chartHeightFor(topProductsByQuantityChart.value.labels))
const topUsersHeight = computed(() => chartHeightFor(data.value?.charts?.topUsers))

const categoryChart = computed(() => {
    const rows = data.value?.charts?.categoryDistribution || []
    return {
        labels: rows.map((r) => r.category),
        datasets: [
            {
                data: rows.map((r) => r.amount),
                backgroundColor: rows.map((_, i) => colors.palette[i % colors.palette.length])
            }
        ]
    }
})

const themeAwareOptions = computed(() => {
    const isDark = isDarkTheme.value
    const tickColor = isDark ? "#cbd5e1" : "#334155"
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: tickColor } },
            tooltip: { backgroundColor: isDark ? "#0f172a" : "#ffffff", titleColor: tickColor, bodyColor: tickColor, borderColor: gridColor, borderWidth: 1 }
        },
        scales: {
            x: { ticks: { color: tickColor }, grid: { color: gridColor } },
            y: { ticks: { color: tickColor }, grid: { color: gridColor }, beginAtZero: true }
        }
    }
})

function truncateChartLabel(label) {
    if (typeof label !== "string") return label
    const MAX = 22
    if (label.length <= MAX) return label
    return label.slice(0, MAX - 1) + "…"
}

const barOptionsHorizontal = computed(() => {
    const base = themeAwareOptions.value
    const baseYTicks = base?.scales?.y?.ticks || {}
    const baseY = base?.scales?.y || {}
    return {
        ...base,
        indexAxis: "y",

        plugins: {
            ...base.plugins,
            legend: { display: false },
            tooltip: {
                ...(base.plugins?.tooltip || {}),
                callbacks: {
                    title: (items) => {
                        if (!items || !items.length) return ""
                        return items[0].label || ""
                    }
                }
            }
        },

        categoryPercentage: 0.9,
        barPercentage: 0.95,

        scales: {
            ...base.scales,
            y: {
                ...baseY,
                ticks: {
                    ...baseYTicks,
                    autoSkip: false,
                    crossAlign: "far",
                    callback: function (value) {
                        return truncateChartLabel(this.getLabelForValue(value) || "")
                    }
                }
            }
        }
    }
})

const doughnutOptions = computed(() => {
    const isDark = isDarkTheme.value
    const tickColor = isDark ? "#cbd5e1" : "#334155"
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "right", labels: { color: tickColor } }
        }
    }
})

function exportCsv() {
    axiosInstance.get(`/statistics/export?${appliedQueryString.value}`, { responseType: "blob" }).then((res) => {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const objUrl = URL.createObjectURL(blob)
        link.href = objUrl
        link.download = `skladan-statistics-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(objUrl)
    })
}

</script>

<template>
    <div class="stats-page">
        <header class="stats-header">
            <h1 class="stats-title">Статистика</h1>
            <div class="stats-actions">
                <Button label="Обновить" icon="pi pi-refresh" outlined size="small" :loading="isFetching" @click="refetch()" />
                <Button label="CSV" icon="pi pi-download" severity="secondary" size="small" @click="exportCsv" />
            </div>
        </header>

        <section class="stats-filters">
            <div class="filter-inline">
                <div class="filter-cell">
                    <span class="filter-label">Диапазон</span>
                    <div class="filter-controls">
                        <DatePicker v-model="customFrom" placeholder="С" dateFormat="dd.mm.yy" showIcon size="small" />
                        <DatePicker v-model="customTo" placeholder="По" dateFormat="dd.mm.yy" showIcon size="small" />
                    </div>
                </div>
                <div class="filter-cell">
                    <span class="filter-label">Заказчики</span>
                    <MultiSelect
                        v-model="selectedUsers"
                        :options="userOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Все"
                        filter
                        :maxSelectedLabels="2"
                        size="small"
                        class="filter-compact"
                    />
                </div>
                <div class="filter-cell">
                    <span class="filter-label">Товары</span>
                    <MultiSelect
                        v-model="selectedProducts"
                        :options="productOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Все"
                        filter
                        :maxSelectedLabels="2"
                        size="small"
                        class="filter-compact"
                    />
                </div>
                <div class="filter-cell filter-cell--apply">
                    <span class="filter-label">&nbsp;</span>
                    <Button
                        label="Применить"
                        icon="pi pi-check"
                        size="small"
                        :severity="filtersDirty ? 'primary' : 'secondary'"
                        :loading="isFetching"
                        @click="applyFilters"
                    />
                </div>
            </div>
        </section>

        <template v-if="!isSuccess">
            <div class="kpi-grid">
                <div v-for="i in 3" :key="'kpi-sk-' + i" class="kpi-card">
                    <Skeleton width="40%" height="0.75rem" />
                    <Skeleton width="60%" height="1.6rem" />
                    <Skeleton width="80%" height="0.75rem" />
                </div>
            </div>
            <div class="charts-grid">
                <div class="chart-card chart-card--wide">
                    <Skeleton width="30%" height="1rem" class="mb-2" />
                    <Skeleton width="100%" height="240px" />
                </div>
                <div v-for="i in 4" :key="'chart-sk-' + i" class="chart-card">
                    <Skeleton width="40%" height="1rem" class="mb-2" />
                    <Skeleton width="100%" height="240px" />
                </div>
            </div>
        </template>

        <template v-else>

            <div class="kpi-grid">
                <div class="kpi-card kpi-card--turnover">
                    <div class="kpi-card__label">Общий оборот</div>
                    <div class="kpi-card__value">{{ formatRub(data.summary.turnover) }}</div>
                    <div class="kpi-card__hint">{{ data.summary.ordersCount.created }} заказ(ов) в периоде</div>
                </div>
                <div class="kpi-card kpi-card--avg">
                    <div class="kpi-card__label">Средний чек</div>
                    <div class="kpi-card__value">{{ formatRub(data.summary.avgOrderValue) }}</div>
                </div>
                <div class="kpi-card kpi-card--rate">
                    <div class="kpi-card__label">Завершаемость</div>
                    <div class="kpi-card__value">{{ data.summary.completionRate }}%</div>
                    <div class="kpi-card__hint">{{ data.summary.ordersCount.completed }} из {{ data.summary.ordersCount.created }}</div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-card chart-card--wide">
                    <h2 class="chart-title">Оборот по дням</h2>
                    <div class="chart-wrap">
                        <Chart type="line" :data="turnoverByDayChart" :options="themeAwareOptions" />
                    </div>
                </div>

                <div v-if="showFlowCharts" class="chart-card">
                    <div class="chart-card__header">
                        <h2 class="chart-title">Продажи vs поступления</h2>
                    </div>
                    <div class="flow-totals">
                        <span class="flow-totals__chip flow-totals__chip--out">
                            <i class="pi pi-arrow-up-right"></i>
                            Продажи {{ formatRub(flowTotals.orders) }}
                        </span>
                        <span class="flow-totals__chip flow-totals__chip--in">
                            <i class="pi pi-arrow-down-left"></i>
                            Поступления {{ formatRub(flowTotals.purchases) }}
                        </span>
                    </div>
                    <div class="chart-wrap">
                        <Chart type="line" :data="flowChart" :options="themeAwareOptions" />
                    </div>
                </div>

                <div v-if="showFlowCharts" class="chart-card">
                    <div class="chart-card__header">
                        <h2 class="chart-title">Расхождения товаров (продано vs получено)</h2>
                    </div>
                    <div class="chart-scroll" style="max-height: 360px">
                        <DataTable
                            :value="flowByProductRows"
                            size="small"
                            scrollable
                            striped-rows
                            show-gridlines
                            data-key="productId"
                        >
                            <Column field="name" header="Товар" style="min-width: 14rem">
                                <template #body="{ data: row }">
                                    <span :title="row.name" class="wrap-name">{{ row.name }}</span>
                                </template>
                            </Column>
                            <Column field="received" header="Получено" style="width: 90px; text-align: right" />
                            <Column field="sold" header="Продано" style="width: 90px; text-align: right" />
                            <Column header="Δ" style="width: 70px; text-align: right">
                                <template #body="{ data: row }">
                                    <span :class="gapClass(row.gap)">{{ row.gap > 0 ? '+' + row.gap : row.gap }}</span>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </div>

                <div class="chart-card">
                    <h2 class="chart-title">Товары по сумме</h2>
                    <div class="chart-scroll">
                        <div class="chart-inner" :style="{ height: topProductsHeight + 'px' }">
                            <Chart type="bar" :data="topProductsChart" :options="barOptionsHorizontal" :plugins="chartPlugins" />
                        </div>
                    </div>
                </div>

                <div class="chart-card">
                    <h2 class="chart-title">Товары по количеству</h2>
                    <div class="chart-scroll">
                        <div class="chart-inner" :style="{ height: topProductsByQuantityHeight + 'px' }">
                            <Chart type="bar" :data="topProductsByQuantityChart" :options="barOptionsHorizontal" :plugins="chartPlugins" />
                        </div>
                    </div>
                </div>

                <div class="chart-card">
                    <h2 class="chart-title">Заказчики</h2>
                    <div class="chart-scroll">
                        <div class="chart-inner" :style="{ height: topUsersHeight + 'px' }">
                            <Chart type="bar" :data="topUsersChart" :options="barOptionsHorizontal" :plugins="chartPlugins" />
                        </div>
                    </div>
                </div>

                <div class="chart-card">
                    <h2 class="chart-title">Распределение по категориям</h2>
                    <div class="chart-wrap chart-wrap--tall">
                        <Chart type="doughnut" :data="categoryChart" :options="doughnutOptions" />
                    </div>
                </div>
            </div>

            <!-- Orders list -->
            <section class="orders-section">
                <h2 class="chart-title">Заказы в выбранном периоде ({{ data.ordersList?.length || 0 }})</h2>
                <DataTable
                    :value="data.ordersList || []"
                    size="small"
                    scrollable
                    class="sticky-actions-table"
                    paginator
                    :rows="20"
                    striped-rows
                    data-key="_id"
                    :rowClass="() => 'cursor-pointer'"
                    @row-click="(e) => openOrderInfo(e.data._id)"
                >
                    <Column field="orderNumber" header="№" sortable style="min-width: 64px">
                        <template #body="{ data: row }">#{{ row.orderNumber }}</template>
                    </Column>
                    <Column field="orderDate" header="Дата" sortable style="min-width: 110px">
                        <template #body="{ data: row }">{{ fmtDate(row.orderDate) }}</template>
                    </Column>
                    <Column header="Заказчик" style="min-width: 120px">
                        <template #body="{ data: row }">{{ row.user?.name || row.user?.login || "—" }}</template>
                    </Column>
                    <Column field="totalAmount" header="Сумма" sortable style="min-width: 100px">
                        <template #body="{ data: row }">{{ formatRub(row.totalAmount) }}</template>
                    </Column>
                    <Column header="Статус" style="min-width: 110px">
                        <template #body="{ data: row }">
                            <StatusPill
                                v-if="row.isCompleted"
                                status="Завершен"
                                kind="order"
                            />
                            <StatusPill
                                v-else-if="row.isPaid"
                                status="Оплачен"
                                kind="order"
                            />
                            <StatusPill v-else status="Новый" kind="order" />
                        </template>
                    </Column>
                    <Column
                        frozen
                        alignFrozen="right"
                        style="min-width: 52px; width: 52px"
                        bodyStyle="text-align:center; padding:4px"
                    >
                        <template #header><span class="sr-only">Действия</span></template>
                        <template #body="{ data: row }">
                            <Button
                                aria-label="Посмотреть заказ"
                                severity="info"
                                icon="pi pi-info-circle"
                                outlined
                                rounded
                                v-tooltip.left="'Посмотреть заказ'"
                                @click.stop="openOrderInfo(row._id)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </section>
        </template>

        <OrderDialog
            v-if="orderInfoVisible"
            v-model:visible="orderInfoVisible"
            :order="orderInfoId"
            :readonly="true"
            @hideOrderDialog="orderInfoVisible = false"
        />
    </div>
</template>

<style scoped>
.stats-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
    min-width: 0;
}
.stats-page > * {
    min-width: 0;
}
.stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
}
.stats-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
}
.stats-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.stats-filters {
    padding: 10px 12px;
    background: var(--p-content-background, #ffffff);
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
}
.filter-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 18px;
}
.filter-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.filter-label {
    font-size: 11px;

    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
:global(.app-dark) .filter-label {
    color: #cbd5e1;
}
.filter-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.filter-compact {
    min-width: 220px;
    max-width: 280px;
}
@media (max-width: 640px) {
    .filter-compact {
        min-width: 100%;
        max-width: 100%;
    }
    .filter-cell {
        width: 100%;
    }

    .filter-cell :deep(.p-selectbutton) {
        flex-wrap: wrap;
        gap: 4px;
    }
    .filter-cell :deep(.p-selectbutton .p-button) {
        flex: 1 1 30%;
        min-width: 28%;
    }
}
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
    gap: 8px;
    opacity: 0.7;
}
.empty-state i {
    font-size: 28px;
}
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 12px;
}
@media (min-width: 768px) {
    .kpi-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}
.kpi-card {
    background: var(--p-content-background, #ffffff);
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}
.kpi-card--turnover { border-left: 4px solid #0ea5e9; }
.kpi-card--avg { border-left: 4px solid #10b981; }
.kpi-card--rate { border-left: 4px solid #f59e0b; }
.kpi-card__label {
    font-size: 12px;

    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.kpi-card__value {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.1;
}
.kpi-card__hint {
    font-size: 12px;
    color: #475569;
}
:global(.app-dark) .kpi-card__label,
:global(.app-dark) .kpi-card__hint {
    color: #cbd5e1;
}
.charts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
}
@media (min-width: 1024px) {
    .charts-grid {
        grid-template-columns: 1fr 1fr;
    }
    .chart-card--wide {
        grid-column: 1 / -1;
    }
}
.chart-card {
    background: var(--p-content-background, #ffffff);
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
}
.chart-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    opacity: 0.85;
}
.chart-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}
.flow-totals {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.flow-totals__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(100, 116, 139, 0.12);
    color: #475569;
}
.flow-totals__chip--out {
    background: rgba(239, 68, 68, 0.14);
    color: #b91c1c;
}
.flow-totals__chip--in {
    background: rgba(16, 185, 129, 0.14);
    color: #047857;
}
.flow-totals__chip--positive {
    background: rgba(34, 197, 94, 0.16);
    color: #15803d;
}
.flow-totals__chip--negative {
    background: rgba(239, 68, 68, 0.16);
    color: #b91c1c;
}
.filter-cell--apply {
    margin-left: auto;
}

.wrap-name {
    display: inline-block;
    white-space: normal;
    word-break: break-word;
    line-height: 1.25;
}
.gap--zero {
    color: #16a34a;
    font-weight: 600;
}
.gap--positive {
    color: #2563eb;
    font-weight: 600;
}
.gap--negative {
    color: #dc2626;
    font-weight: 600;
}
.chart-wrap {
    position: relative;
    height: 240px;
}

.chart-wrap--tall {
    position: relative;
    flex: 1 1 auto;
    min-height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.chart-wrap--tall :deep(.p-chart),
.chart-wrap--tall :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
}

.chart-scroll {
    max-height: 520px;
    overflow-y: auto;

    scrollbar-width: thin;
    scrollbar-color: rgba(100, 116, 139, 0.4) transparent;
}
.chart-scroll::-webkit-scrollbar {
    width: 6px;
}
.chart-scroll::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.4);
    border-radius: 6px;
}
.chart-scroll::-webkit-scrollbar-track {
    background: transparent;
}
.chart-inner {
    position: relative;
    min-height: 220px;
}

.chart-inner :deep(.p-chart),
.chart-inner :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
}
.orders-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
</style>
