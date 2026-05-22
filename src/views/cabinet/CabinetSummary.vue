<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCurrentUser } from "@/composables/useCurrentUser"
import axiosInstance from "@/service/axios"
import { FilterMatchMode } from "@primevue/core/api"
import { useQuery } from "@tanstack/vue-query"
import { computed, ref } from "vue"

const currentUser = useCurrentUser()
const canSummary = computed(() => (currentUser.value?.role?.permissions || []).includes("view_cabinet_summary"))
const canAll = computed(() => (currentUser.value?.role?.permissions || []).includes("view_all_cabinets"))

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
})

const allFilters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
})
const allSelectedUsers = ref([])

const tab = ref(0)

const { data: summary, isSuccess: isSummarySuccess, isFetching: isSummaryFetching } = useQuery({
    queryKey: ["cabinet-summary"],
    queryFn: async () => (await axiosInstance.get("/cabinet/summary")).data,
    staleTime: 30_000
})

const { data: allItems, isSuccess: isAllSuccess, isFetching: isAllFetching } = useQuery({
    queryKey: ["cabinet-all"],
    queryFn: async () => (await axiosInstance.get("/cabinet/all")).data,
    staleTime: 30_000
})

const summarySkeleton = Array.from({ length: 8 }, (_, i) => ({ productId: `sk-${i}`, _skeleton: true }))
const allSkeleton = Array.from({ length: 8 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))
const summaryRows = computed(() => (isSummarySuccess.value && summary.value ? summary.value : summarySkeleton))

const userOptions = computed(() => {
    if (!isAllSuccess.value || !Array.isArray(allItems.value)) return []
    const seen = new Map()
    for (const item of allItems.value) {
        const u = item?.user
        if (!u?._id) continue
        const id = String(u._id)
        if (!seen.has(id)) seen.set(id, { label: u.name || u.login || "—", value: id })
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, "ru"))
})

const allRows = computed(() => {
    if (!isAllSuccess.value || !allItems.value) return allSkeleton
    const filterIds = allSelectedUsers.value
    if (!filterIds.length) return allItems.value
    return allItems.value.filter((it) => filterIds.includes(String(it.user?._id)))
})

function formatRub(value) {
    if (!value) return "0 ₽"
    return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const totalDeficitValue = computed(() => {
    return (summary.value || []).reduce((acc, r) => acc + Math.max(0, r.totalDeficit || 0) * (r.price || 0), 0)
})
</script>

<template>
    <div class="cs-page">
        <header class="cs-header">
            <h1 class="cs-title">Личные склады представителей</h1>
            <Tag :value="`Общий дефицит: ${formatRub(totalDeficitValue)}`" severity="warn" />
        </header>

        <TabView v-model:activeIndex="tab">
            <TabPanel v-if="canSummary" header="Общая сводка по товарам">
                <DataTable
                    :value="summaryRows"
                    size="small"
                    paginator
                    :rows="50"
                    :rowsPerPageOptions="[25, 50, 100, 200]"
                    v-model:filters="filters"
                    :globalFilterFields="['name', 'category']"
                    striped-rows
                    show-gridlines
                    data-key="productId"
                    :loading="isSummaryFetching && !isSummarySuccess"
                >
                    <template #header>
                        <div class="cs-table-header">
                            <IconField>
                                <InputIcon><i class="pi pi-search" /></InputIcon>
                                <InputText v-model="filters['global'].value" placeholder="Поиск..." />
                            </IconField>
                        </div>
                    </template>
                    <Column field="name" header="Товар" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="80%" height="1rem" />
                            <span v-else>{{ row.name }}</span>
                        </template>
                    </Column>
                    <Column field="category" header="Вид" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="50%" height="1rem" />
                            <span v-else>{{ row.category }}</span>
                        </template>
                    </Column>
                    <Column field="price" header="Цена" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="3rem" height="1rem" />
                            <span v-else>{{ formatRub(row.price) }}</span>
                        </template>
                    </Column>
                    <Column field="stockQty" header="На складе" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.stockQty }}</span>
                        </template>
                    </Column>
                    <Column field="productTargetQty" header="Цель товара" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.productTargetQty }}</span>
                        </template>
                    </Column>
                    <Column field="totalBaseQty" sortable>
                        <template #header>
                            <span v-tooltip.top="'Сумма целей всех представителей'">Σ целей</span>
                        </template>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <b v-else>{{ row.totalBaseQty }}</b>
                        </template>
                    </Column>
                    <Column field="totalCurrentQty" sortable>
                        <template #header>
                            <span v-tooltip.top="'Сумма того, что уже есть у представителей'">Σ</span>
                        </template>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.totalCurrentQty }}</span>
                        </template>
                    </Column>
                    <Column field="totalInOrders" sortable>
                        <template #header>
                            <span v-tooltip.top="'Сумма по активным (незавершённым) заказам представителей'">Σ в заказах</span>
                        </template>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.totalInOrders || 0 }}</span>
                        </template>
                    </Column>
                    <Column field="totalDeficit" sortable>
                        <template #header>
                            <span v-tooltip.top="'Σ целей − Σ у представителей − Σ в заказах'">Σ дефицит</span>
                        </template>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1.4rem" border-radius="999px" />
                            <Tag v-else-if="row.totalDeficit > 0" :value="row.totalDeficit" severity="warn" />
                            <span v-else>—</span>
                        </template>
                    </Column>
                    <Column field="usersCount" header="Заказчиков" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.usersCount }}</span>
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <TabPanel v-if="canAll" header="Все позиции по заказчикам">
                <DataTable
                    :value="allRows"
                    size="small"
                    paginator
                    :rows="50"
                    :rowsPerPageOptions="[25, 50, 100, 200]"
                    striped-rows
                    show-gridlines
                    sort-mode="single"
                    sort-field="user.name"
                    :sort-order="1"
                    data-key="_id"
                    v-model:filters="allFilters"
                    :globalFilterFields="['user.name', 'user.login', 'product.name', 'product.category', 'customName', 'note']"
                    :loading="isAllFetching && !isAllSuccess"
                >
                    <template #header>
                        <div class="cs-all-toolbar">
                            <MultiSelect
                                v-model="allSelectedUsers"
                                :options="userOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Все заказчики"
                                filter
                                :maxSelectedLabels="3"
                                size="small"
                                class="cs-users-filter"
                            />
                            <IconField>
                                <InputIcon><i class="pi pi-search" /></InputIcon>
                                <InputText
                                    v-model="allFilters['global'].value"
                                    placeholder="Поиск товара / заказчика..."
                                    style="font-size: 16px; min-width: 18rem"
                                />
                            </IconField>
                        </div>
                    </template>
                    <Column field="user.name" header="Заказчик" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="60%" height="1rem" />
                            <span v-else>{{ row.user?.name || row.user?.login || "—" }}</span>
                        </template>
                    </Column>
                    <Column header="Товар">
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="70%" height="1rem" />
                            <span v-else-if="row.product">{{ row.product.name }}</span>
                            <span v-else class="custom-name">{{ row.customName }} <small>(своя)</small></span>
                        </template>
                    </Column>
                    <Column field="product.category" header="Вид">
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="50%" height="1rem" />
                            <span v-else>{{ row.product?.category }}</span>
                        </template>
                    </Column>
                    <Column field="baseQty" header="Цель" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.baseQty }}</span>
                        </template>
                    </Column>
                    <Column field="currentQty" header="У него" sortable>
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                            <span v-else>{{ row.currentQty }}</span>
                        </template>
                    </Column>
                    <Column header="Дефицит">
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="2rem" height="1.4rem" border-radius="999px" />
                            <Tag v-else-if="(row.baseQty || 0) - (row.currentQty || 0) > 0" :value="(row.baseQty || 0) - (row.currentQty || 0)" severity="warn" />
                            <span v-else>—</span>
                        </template>
                    </Column>
                    <Column field="note" header="Заметка">
                        <template #body="{ data: row }">
                            <Skeleton v-if="row._skeleton" width="50%" height="1rem" />
                            <span v-else>{{ row.note }}</span>
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>
        </TabView>
    </div>
</template>

<style scoped>
.cs-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
}
.cs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
}
.cs-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
}
.cs-table-header {
    display: flex;
    justify-content: flex-end;
}
.cs-all-toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}
.cs-users-filter {
    min-width: 220px;
    max-width: 320px;
}
@media (max-width: 640px) {
    .cs-users-filter {
        min-width: 100%;
        max-width: 100%;
    }
}
.custom-name {
    font-style: italic;
}
</style>
