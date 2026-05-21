<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import StatusPill from "@/components/StatusPill.vue"
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"
import InventoryDialog from "./InventoryDialog.vue"

const queryClient = useQueryClient()
const toast = useToast()
const inventorizations = ref([])
const newInventorizationDialog = ref(null)
const inventorizationDialog = ref(null)
const inventorization = ref({})

const user = ref(JSON.parse(localStorage.getItem("user") || "null"))

const { isError, data, error, isSuccess, isFetching, failureCount } = useQuery({
    queryKey: ["inventorizations"],
    queryFn: async () => await axiosInstance.get("/inventory"),
    refetchOnWindowFocus: false,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { mutate: createInventorization, isSuccess: isSuccessCreate } = useMutation({
    mutationKey: ["inventorization", "create"],
    mutationFn: async (prefillFromStock) => {
        return await axiosInstance.post("/inventory", { prefillFromStock: prefillFromStock === true })
    },
    onSuccess: (data) => {

        queryClient.invalidateQueries({ queryKey: ["inventorization", data.data._id] })
        queryClient.invalidateQueries({ queryKey: ["inventorizations"] })
        toast.add({ severity: "success", summary: "Успешно", detail: "Инвентаризация создана", life: 3000 })
        inventorization.value = data.data?._id
        inventorizationDialog.value = true
        newInventorizationDialog.value = false
    },
    onError: (e) => {
        newInventorizationDialog.value = false
        toast.add({
            severity: "warn",
            summary: "Нельзя начать инвентаризацию",
            detail: e?.response?.data?.message || "Сначала завершите все заказы и закупки.",
            life: 7000
        })
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        inventorizations.value = data.value
    }
})

const skeletonRows = Array.from({ length: 6 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))

const showSkeleton = computed(() => !isSuccess.value || failureCount.value > 0)
const tableRows = computed(() => (showSkeleton.value ? skeletonRows : inventorizations.value))

const latestInventoryId = computed(() => {
    if (!isSuccess.value || !inventorizations.value.length) return null
    let latest = inventorizations.value[0]
    for (const inv of inventorizations.value) {
        if ((inv.startDate || 0) > (latest.startDate || 0)) latest = inv
    }
    return latest?._id || null
})
const openedIsLatest = computed(() => {
    const id = typeof inventorization.value === "string" ? inventorization.value : inventorization.value?._id
    return !!id && id === latestInventoryId.value
})

function editInventorization(_id) {
    inventorization.value = _id
    inventorizationDialog.value = true
}

function hideInventoryDialog() {
    inventorization.value = {}
    inventorizationDialog.value = false
}
</script>

<template>
    <div class="card">
        <Toolbar v-if="user.role?.permissions?.includes('create_inventory')" class="mb-6">
            <template #start>
                <Button
                    :disabled="inventorizations.some((item) => !item.isCompleted) || !user.role?.permissions?.includes('create_inventory')"
                    label="Создать"
                    icon="pi pi-plus"
                    severity="secondary"
                    class="mr-2"
                    @click="newInventorizationDialog = true"
                />
            </template>
        </Toolbar>
        <DataTable
            sortField="startDate"
            :sortOrder="-1"
            class="w-[100%] sticky-actions-table"
            scrollable
            size="small"
            :value="tableRows"
            :paginator="true"
            :rows="50"
            :rowsPerPageOptions="[25, 50, 100, 200]"
            paginator-position="bottom"
            data-key="_id"
            :loading="showSkeleton"
        >
            <Column field="complete" header="Статус">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="6rem" height="1.4rem" border-radius="999px" />
                    <StatusPill v-else :status="slotProps.data.isCompleted ? 'Завершена' : 'Ожидание'" kind="inventory" />
                </template>
            </Column>
            <Column field="date">
                <template #header><span>Дата</span></template>
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="7rem" height="1rem" />
                    <span v-else>{{ formatTimestamp(slotProps.data.startDate) }}</span>
                </template>
            </Column>
            <Column frozen alignFrozen="right" style="min-width: 52px; width: 52px" bodyStyle="text-align:center; padding:4px">
                <template #header><span class="sr-only">Действия</span></template>
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" shape="circle" size="2rem" />
                    <Button v-else size="small" severity="info" icon="pi pi-info-circle" aria-label="Детали инвентаризации" outlined rounded v-tooltip.left="'Детали'" @click="editInventorization(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>

        <Dialog :closable="false" v-model:visible="newInventorizationDialog" :style="{ width: '95%', maxWidth: '560px' }" :breakpoints="{ '768px': '100vw' }" header="Новая инвентаризация" :modal="true">
            <p class="mb-4">Выберите, как заполнить количества на старте:</p>
            <div class="inv-mode">
                <div class="inv-mode__title">
                    <b>Свести с остатками</b>
                    <span class="inv-mode__reco">рекомендуется</span>
                </div>
                <p class="inv-mode__desc">
                    Каждая позиция начнётся с текущего остатка склада, отклонение = 0.
                    Правьте только те товары, где есть расхождение. Незатронутые позиции
                    останутся без изменений.
                </p>
            </div>
            <div class="inv-mode">
                <div class="inv-mode__title"><b>Пустая (с нуля)</b></div>
                <p class="inv-mode__desc">
                    Все позиции начнутся с 0. Нужно вручную вписать фактическое количество
                    по каждому товару. Незаполненные позиции при завершении обнулят остаток
                    на складе.
                </p>
            </div>
            <template #footer>
                <Button label="Отмена" icon="pi pi-times" text severity="secondary" @click="newInventorizationDialog = false" />
                <Button label="Пустая (с нуля)" icon="pi pi-stop-circle" severity="secondary" outlined @click="createInventorization(false)" />
                <Button label="Свести с остатками" icon="pi pi-check" severity="success" @click="createInventorization(true)" />
            </template>
        </Dialog>

        <InventoryDialog v-if="inventorizationDialog" :editable="user.role?.permissions?.includes('edit_inventory') && openedIsLatest" v-model:visible="inventorizationDialog" :inventorization="inventorization" @hideInventoryDialog="hideInventoryDialog" />
    </div>
</template>

<style lang="scss">
.p-datatable-column-sorted {
    background: var(--p-datatable-header-cell-background) !important;

    color: var(--p-datatable-header-cell-color) !important;
}

.inv-mode {
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.12));
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
}
.inv-mode__title {
    display: flex;
    align-items: center;
    gap: 8px;
}
.inv-mode__reco {
    font-size: 11px;
    text-transform: uppercase;
    color: #16a34a;
    border: 1px solid #16a34a;
    border-radius: 999px;
    padding: 1px 8px;
}
.inv-mode__desc {
    margin: 6px 0 0;
    font-size: 13px;
    opacity: 0.75;
}
</style>
