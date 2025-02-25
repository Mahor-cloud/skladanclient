<script setup>
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

const user = ref(JSON.parse(localStorage.getItem("user")))

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

const { data, isSuccess } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => await axiosInstance.get("/purchases"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { mutate: createPurchaseOrder } = useMutation({
    mutationKey: ["create_purchase"],
    mutationFn: async () => await axiosInstance.post("/purchases"),
    onSuccess: (data) => {
        queryClient.setQueryData(["purchaseOrder", data.data._id], data)
        queryClient.invalidateQueries(["purchases"])
        toast.add({ severity: "success", summary: "Успешно", detail: "Закупка создана", life: 3000 })
        purchaseOrder.value = data.data?._id
        confirmCreatePurchaseOrderDialog.value = false
        purchaseOrderDialog.value = true
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
        <DataTable size="small" :value="purchases" sortField="purchaseDate" :sortOrder="-1" filterDisplay="menu" v-model:filters="filters" :globalFilterFields="['user.name', 'purchaseDate', 'status', 'purchaseNumber']">
            <Column field="purchaseNumber" sortable filterField="purchaseNumber" header="№" style="padding: 0.1rem; max-width: 20px"></Column>
            <Column field="user.name" filterField="user.name" style="max-width: 70px" header="Заказчик"></Column>
            <Column field="date" filterField="purchaseDate" style="max-width: 60px" header="Дата">
                <template #body="slotProps">
                    <p style="font-size: 0.8rem">
                        {{ formatTimestamp(slotProps.data.purchaseDate) }}
                    </p>
                </template>
            </Column>
            <Column field="status" filterField="status" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" header="Статус" style="padding: 0.1rem; max-width: 40px">
                <template #body="slotProps">
                    <Message size="small" variant="simple" severity="success">{{ slotProps.data.status }}</Message>
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
            <Column>
                <template #body="slotProps">
                    <Button label="" severity="info" icon="pi pi-info-circle" outlined rounded @click="editPurchaseOrder(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog :closable="false" v-model:visible="confirmCreatePurchaseOrderDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center">
            <span>Вы уверенны что хотите начать закупку?</span>
        </div>
        <template #footer>
            <Button label="No" icon="pi pi-times" text @click="confirmCreatePurchaseOrderDialog = false" />
            <Button v-if="user.role?.permissions?.includes('create_purchases')" label="Yes" icon="pi pi-check" @click="createPurchaseOrder()" />
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
