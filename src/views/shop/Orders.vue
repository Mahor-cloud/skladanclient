<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import StatusPill from "@/components/StatusPill.vue"
import { useCurrentUser } from "@/composables/useCurrentUser"
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { FilterMatchMode } from "@primevue/core/api"
import { useQuery } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"
import OrderDialog from "./OrderDialog.vue"

const toast = useToast()
const orders = ref([])
const order = ref({})
const orderDialog = ref(false)
const visible = ref(false)

const currentUser = useCurrentUser()
const currentUserId = computed(() => currentUser.value?._id || null)
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.IN },
    date: { value: null, matchMode: FilterMatchMode.IN }
})

const clearFilter = () => {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        status: { value: null, matchMode: FilterMatchMode.IN },
        date: { value: null, matchMode: FilterMatchMode.IN }
    }
}

const statuses = computed({
    get() {
        const statuses = []
        orders.value.forEach((order) => {
            if (!statuses.includes(order.status)) {
                statuses.push(order.status)
            }
        })
        return statuses.map((status) => ({ status }))
    }
})

const { data, isSuccess, isFetching, failureCount } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => await axiosInstance.get("/orders"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { data: shortagesData } = useQuery({
    queryKey: ["orderShortages"],
    queryFn: async () => (await axiosInstance.get("/orders/shortages")).data,
    staleTime: 30_000,
    refetchInterval: 60_000
})
const shortages = computed(() => shortagesData.value || [])
const blockedOrderIds = computed(() => {
    const s = new Set()
    for (const sh of shortages.value) for (const id of sh.orderIds) s.add(String(id))
    return s
})
function rowClass(row) {
    if (!row || row._skeleton) return ""

    if (blockedOrderIds.value.has(String(row._id))) return "shortage-row"
    const uid = currentUserId.value
    if (uid && String(row.user?._id) === String(uid)) return "own-row"
    return ""
}

const skeletonRows = Array.from({ length: 10 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))

const showSkeleton = computed(() => !isSuccess.value || failureCount.value > 0)
const tableRows = computed(() => (showSkeleton.value ? skeletonRows : orders.value))

watchEffect(() => {
    if (isSuccess.value) {
        orders.value = [
            ...data.value.map((order) => {
                return {
                    ...order,
                    status: order.isCompleted ? "Завершен" : order.isPaid && order.confirmedPaid ? "К выдаче" : order.isPaid && !order.confirmedPaid ? "Оплачен" : "Новый"
                }
            })
        ]
    }
})

function openOrderDialog(_id) {
    order.value = _id
    visible.value = true
}

function hideOrderDialog() {
    visible.value = false
    order.value = {}
}
</script>

<template>
    <div class="card">
        <div v-if="shortages.length" class="mb-4 flex flex-col gap-2">
            <Message v-for="s in shortages" :key="s.product" severity="error" :closable="false">
                Расхождение по товару «<b>{{ s.productName }}</b>»: заказы №{{ s.orderNumbers.join(", ") }} не могут быть завершены. Требуется <b>{{ s.required }}</b>, на складе <b>{{ s.inStock }}</b>. Пополните склад или скорректируйте заказы.
            </Message>
        </div>
        <DataTable
            size="small"
            scrollable
            class="sticky-actions-table"
            :value="tableRows"
            :rowClass="(d) => ((rowClass(d) || '') + ' cursor-pointer').trim()"
            sortField="orderDate"
            :sortOrder="-1"
            v-model:filters="filters"
            filterDisplay="menu"
            :globalFilterFields="['user.name', 'orderDate', 'status', 'orderNumber']"
            :paginator="true"
            :rows="50"
            :rowsPerPageOptions="[25, 50, 100, 200]"
            paginator-position="bottom"
            data-key="_id"
            :loading="showSkeleton"
            @row-click="(e) => !e.data?._skeleton && openOrderDialog(e.data._id)"
        >
            <template #header>
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <Button type="button" icon="pi pi-filter-slash" aria-label="Сбросить фильтры" outlined @click="clearFilter()" />
                    <div style="flex-grow: 1; max-width: 12rem" class="justify-end inline-flex">
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText style="max-width: 13rem; font-size: 16px" v-model="filters['global'].value" placeholder="Поиск..." />
                        </IconField>
                    </div>
                </div>
            </template>
            <Column field="orderNumber" filterField="orderNumber" header="№" style="padding: 0.1rem; min-width: 48px">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="2rem" height="1rem" />
                    <span v-else>{{ slotProps.data.orderNumber }}</span>
                </template>
            </Column>
            <Column field="user.name" filterField="user.name" style="min-width: 120px" header="Заказчик">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="80%" height="1rem" />
                    <span v-else>{{ slotProps.data.user?.name }}</span>
                </template>
            </Column>
            <Column field="status" filterField="status" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" header="Статус" style="padding: 0.1rem; min-width: 110px">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="5rem" height="1.4rem" border-radius="999px" />
                    <StatusPill v-else :status="slotProps.data.status" kind="order" />
                </template>
                <template #filter="{ filterModel }">
                    <MultiSelect style="max-width: 200px" v-model="filterModel.value" :options="statuses" optionLabel="status" optionValue="status" placeholder="Any">
                        <template #option="slotProps">
                            <div class="flex items-center">
                                <span>{{ slotProps.option.status }}</span>
                            </div>
                        </template>
                    </MultiSelect>
                </template>
            </Column>
            <Column field="date" style="min-width: 100px" filterField="orderDate" header="Дата">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="6rem" height="1rem" />
                    <p v-else style="font-size: 14px">{{ formatTimestamp(slotProps.data.orderDate) }}</p>
                </template>
            </Column>
            <Column frozen alignFrozen="right" style="min-width: 52px; width: 52px" bodyStyle="text-align:center; padding:4px">
                <template #header><span class="sr-only">Действия</span></template>
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" shape="circle" size="2rem" />
                    <Button v-else aria-label="Детали заказа" severity="info" icon="pi pi-info-circle" @click="openOrderDialog(slotProps.data._id)" outlined rounded />
                </template>
            </Column>
        </DataTable>

        <OrderDialog v-if="visible" v-model:visible="visible" :order="order" @hideOrderDialog="hideOrderDialog" />
    </div>
</template>

<style scoped>

:deep(.shortage-row) > td:not(.p-datatable-frozen-column) {
    background: rgba(239, 68, 68, 0.14) !important;
}
:deep(.shortage-row:hover) > td:not(.p-datatable-frozen-column) {
    background: rgba(239, 68, 68, 0.22) !important;
}
:deep(.own-row) > td:not(.p-datatable-frozen-column) {
    background: rgba(59, 130, 246, 0.1) !important;
}
:deep(.own-row:hover) > td:not(.p-datatable-frozen-column) {
    background: rgba(59, 130, 246, 0.18) !important;
}
</style>
