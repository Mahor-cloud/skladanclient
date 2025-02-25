<script setup>
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

const { data, isSuccess } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => await axiosInstance.get("/orders"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

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
        <DataTable size="small" :value="orders" sortField="orderDate" :sortOrder="-1" v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['user.name', 'orderDate', 'status', 'orderNumber']">
            <template #header>
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <Button type="button" icon="pi pi-filter-slash" outlined @click="clearFilter()" />
                    <div style="flex-grow: 1; max-width: 12rem" class="justify-end inline-flex">
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText style="max-width: 13rem; font-size: 0.8rem" v-model="filters['global'].value" placeholder="Поиск..." />
                        </IconField>
                    </div>
                </div>
            </template>
            <Column field="orderNumber" filterField="orderNumber" header="№" style="padding: 0.1rem; max-width: 20px"></Column>
            <Column field="user.name" filterField="user.name" style="max-width: 70px" header="Заказчик"></Column>
            <Column field="date" style="max-width: 60px" filterField="orderDate" header="Дата">
                <template #body="slotProps"
                    ><p style="font-size: 0.8rem">
                        {{ formatTimestamp(slotProps.data.orderDate) }}
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
                    <Button label="" severity="info" icon="pi pi-info-circle" @click="openOrderDialog(slotProps.data._id)" outlined rounded />
                </template>
            </Column>
        </DataTable>

        <OrderDialog v-if="visible" v-model:visible="visible" :order="order" @hideOrderDialog="hideOrderDialog" />
    </div>
</template>
