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
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue"
import { computed, ref, watchEffect } from "vue"
import PurchaseDialog from "./PurchaseDialog.vue"

const purchases = ref()
const purchaseOrder = ref({})
const purchaseOrderDialog = ref(false)
const confirmCreatePurchaseOrderDialog = ref(false)
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.IN },
    date: { value: null, matchMode: FilterMatchMode.IN }
})

const user = useCurrentUser()

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
        purchases.value?.forEach((purchase) => {
            if (!statuses.includes(purchase.status)) {
                statuses.push(purchase.status)
            }
        })
        return statuses.map((status) => ({ status }))
    }
})

const toast = useToast()

const queryClient = useQueryClient()

const { data, isSuccess, isFetching, failureCount } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => await axiosInstance.get("/purchases"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const skeletonRows = Array.from({ length: 10 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))

const showSkeleton = computed(() => !isSuccess.value || failureCount.value > 0)
const tableRows = computed(() => (showSkeleton.value || !purchases.value ? skeletonRows : purchases.value))

const { mutate: createPurchaseOrder } = useMutation({
    mutationKey: ["create_purchase"],
    mutationFn: async () => await axiosInstance.post("/purchases"),
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["purchaseOrder", data.data._id] })
        queryClient.invalidateQueries({ queryKey: ["purchases"] })
        toast.add({ severity: "success", summary: "Успешно", detail: "Закупка создана", life: 3000 })
        purchaseOrder.value = data.data?._id
        confirmCreatePurchaseOrderDialog.value = false
        purchaseOrderDialog.value = true
    },
    onError: (err) => {
        confirmCreatePurchaseOrderDialog.value = false
        const payload = err?.response?.data
        toast.add({
            severity: "error",
            summary: payload?.code === "ACTIVE_INVENTORY" ? "Закупка невозможна" : "Ошибка",
            detail: payload?.message || err?.message || "Не удалось создать закупку",
            life: 7000
        })
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        purchases.value = [
            ...data.value.map((purchase) => {
                return {
                    ...purchase,
                    status: purchase.isCompleted ? "Завершен" : purchase.partialCompleted ? "Частично завершен" : purchase.isPaid && purchase.isCreated ? "Ожидание получения" : purchase.isCreated ? "Ожидание оплаты" : "Новый"
                }
            })
        ]
    }
})

function editPurchaseOrder(_id) {
    purchaseOrder.value = _id
    purchaseOrderDialog.value = true
}

function hidePurchaseOrderDialog() {
    purchaseOrder.value = {}
    purchaseOrderDialog.value = false
}
</script>
<template>
    <div class="card">
        <Toolbar v-if="user.role?.permissions?.includes('create_purchases')" class="mb-6">
            <template #start>
                <Button label="Создать" icon="pi pi-plus" severity="secondary" class="mr-2" @click="confirmCreatePurchaseOrderDialog = true" />
            </template>
        </Toolbar>
        <DataTable
            size="small"
            scrollable
            class="sticky-actions-table"
            :value="tableRows"
            sortField="purchaseDate"
            :sortOrder="-1"
            filterDisplay="menu"
            v-model:filters="filters"
            :globalFilterFields="['user.name', 'purchaseDate', 'status', 'purchaseNumber']"
            :paginator="true"
            :rows="50"
            :rowsPerPageOptions="[25, 50, 100, 200]"
            paginator-position="bottom"
            data-key="_id"
            :loading="showSkeleton"
            :rowClass="() => 'cursor-pointer'"
            @row-click="(e) => !e.data?._skeleton && editPurchaseOrder(e.data._id)"
        >
            <Column field="purchaseNumber" sortable filterField="purchaseNumber" header="№" style="padding: 0.1rem; min-width: 48px">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="2rem" height="1rem" />
                    <span v-else>{{ slotProps.data.purchaseNumber }}</span>
                </template>
            </Column>
            <Column field="user.name" filterField="user.name" style="min-width: 120px" header="Заказчик">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="80%" height="1rem" />
                    <span v-else>{{ slotProps.data.user?.name }}</span>
                </template>
            </Column>
            <Column field="status" filterField="status" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" header="Статус" style="padding: 0.1rem; min-width: 90px">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="6rem" height="1.4rem" border-radius="999px" />
                    <StatusPill v-else :status="slotProps.data.status" kind="purchase" />
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
            <Column field="date" filterField="purchaseDate" style="min-width: 100px" header="Дата">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="6rem" height="1rem" />
                    <p v-else style="font-size: 14px">{{ formatTimestamp(slotProps.data.purchaseDate) }}</p>
                </template>
            </Column>
            <Column frozen alignFrozen="right" style="min-width: 52px; width: 52px" bodyStyle="text-align:center; padding:4px">
                <template #header><span class="sr-only">Действия</span></template>
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" shape="circle" size="2rem" />
                    <Button v-else aria-label="Детали закупки" severity="info" icon="pi pi-info-circle" outlined rounded @click="editPurchaseOrder(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog :closable="false" v-model:visible="confirmCreatePurchaseOrderDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center">
            <span>Вы уверенны что хотите начать закупку?</span>
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="confirmCreatePurchaseOrderDialog = false" />
            <Button v-if="user.role?.permissions?.includes('create_purchases')" label="Да" icon="pi pi-check" @click="createPurchaseOrder()" />
        </template>
    </Dialog>

    <PurchaseDialog
        v-if="purchaseOrderDialog"
        :approvePayment="user.role?.permissions?.includes('approve-payment')"
        :editable="user.role?.permissions?.includes('edit_purchases')"
        v-model:visible="purchaseOrderDialog"
        :order="purchaseOrder"
        @hidePurchaseOrderDialog="hidePurchaseOrderDialog"
    />
</template>
