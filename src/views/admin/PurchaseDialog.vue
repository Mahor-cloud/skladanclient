<script setup>
import axiosInstance from "@/service/axios"
import { FilterMatchMode } from "@primevue/core/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, ref, watchEffect } from "vue"
const props = defineProps({
    visible: Boolean,
    order: String,
    editable: Boolean,
    approvePayment: Boolean
})
const emit = defineEmits(["hidePurchaseOrderDialog"])

const visible = ref(props.visible)
const purchaseOrder = ref({})
const confirmDeleteDialog = ref(false)
const confirmPaidDialog = ref(false)
const confirmCompeteDialog = ref(false)
const totalMessage = computed({
    get() {
        return `Итого: ${formatCurrency(purchaseOrder?.value?.items?.reduce((acc, item) => acc + item.price * item.buyQuantity, 0)) || 0 + " ₽"}`
    }
})

const categories = computed({
    get() {
        return Array.from(new Set(purchaseOrder?.value?.items?.map((item) => item.category))).map((category) => ({ category }))
    }
})

const partialCompleted = computed({
    get() {
        return purchaseOrder?.value?.items?.some((item) => item.confirmedQuantity < item.buyQuantity)
    }
})

const queryClient = useQueryClient()

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    category: { value: null, matchMode: FilterMatchMode.IN }
})

const clearFilter = () => {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        category: { value: null, matchMode: FilterMatchMode.IN }
    }
}

const inputStyleObject = {
    maxWidth: "40px",
    padding: "2px",
    textAlign: "center"
}

const { data, isSuccess } = useQuery({
    queryKey: ["purchaseOrder", props.order],
    queryFn: async () => await axiosInstance.get(`/purchases/${props.order}`),
    select: (data) => data.data,
    enabled: !!props.order,
    staleTime: 1000 * 60 * 5
})

const { mutate: updatePurchaseOrder } = useMutation({
    mutationKey: ["purchaseOrder", props.order],
    mutationFn: async (data) => await axiosInstance.put(`/purchases/${props.order}`, data),
    onSuccess: (data) => {
        queryClient.invalidateQueries(["purchaseOrder", data.data._id], data.value)
        queryClient.invalidateQueries({ queryKey: ["purchases"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        confirmPaidDialog.value = false
        confirmCompeteDialog.value = false
    }
})

const { mutate: deletePurchaseOrder } = useMutation({
    mutationKey: ["delete_order", props.order],
    mutationFn: async () => await axiosInstance.delete(`/purchases/${props.order}`),
    onSuccess: (data) => {
        queryClient.setQueryData(["purchaseOrder", data.data._id], {})
        queryClient.invalidateQueries({ queryKey: ["purchases"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        confirmDeleteDialog.value = false
        emit("hidePurchaseOrderDialog")
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        purchaseOrder.value = {
            ...data.value,
            items: [
                ...data.value.items.map((item) => ({
                    ...item.product,
                    buyQuantity: item.quantity,
                    confirmedQuantity: item.confirmedQuantity,
                    receivedQuantity: item.confirmedQuantity
                }))
            ],
            status: data.value.isCompleted ? "Завершен" : data.value.partialCompleted ? "Частично завершен" : data.value.isPaid && data.value.isCreated ? "Ожидание получения" : data.value.isCreated ? "Ожидание оплаты" : "Новый"
        }
    }
})

function handleUpdatePurchaseOrder(isCreated, isPaid, partialCompleted, isCompleted) {
    if (!purchaseOrder.value.isCreated && isCreated) {
        purchaseOrder.value.items = purchaseOrder.value.items.filter((item) => item.buyQuantity > 0 && item.confirmedQuantity == 0)
    }
    if (purchaseOrder.value.items.length == 0) {
        return emit("hidePurchaseOrderDialog")
    }
    updatePurchaseOrder({
        ...purchaseOrder.value,
        isCreated,
        isPaid,
        partialCompleted,
        isCompleted,
        items: purchaseOrder.value.items.map((item) => ({
            product: item._id,
            quantity: item.buyQuantity,
            confirmedQuantity: item.confirmedQuantity
        }))
    })
}

function formatCurrency(value) {
    if (value) return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return
}
</script>

<template>
    <Dialog :style="{ width: '100%', height: '100%' }" :header="`Закупка номер ${purchaseOrder?.purchaseNumber}, Заказчик: ${purchaseOrder?.user?.name}`" v-model:visible="visible" :modal="true" v-on:update:visible="emit('hidePurchaseOrderDialog')">
        <div class="flex flex-col items-center text-center">
            <Message class="justify-center mb-4" size="large" variant="simple"> {{ purchaseOrder.status }}</Message>
        </div>

        <Divider type="dashed" />

        <DataTable :value="purchaseOrder?.items" dataKey="_id" v-model:filters="filters" :globalFilterFields="['name', 'price', 'category']" filterDisplay="menu" show-gridlines>
            <template #header>
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <div>
                        <Button type="button" icon="pi pi-filter-slash" outlined @click="clearFilter()" />
                    </div>
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
            <Column field="name" header="Название" style="max-width: 1.5rem; padding: 0.3rem"></Column>
            <Column header="Вид" field="category" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="max-width: 0.5rem; padding: 0.3rem">
                <template #body="{ data }">
                    <span>{{ data.category }}</span>
                </template>
                <template #filter="{ filterModel }">
                    <MultiSelect style="max-width: 200px" v-model="filterModel.value" :options="categories" showClear optionLabel="category" optionValue="category" placeholder="Все">
                        <template #option="slotProps">
                            <div class="flex items-center">
                                <span>{{ slotProps.option.category }}</span>
                            </div>
                        </template>
                    </MultiSelect>
                </template>
            </Column>
            <Column field="quantity" style="max-width: 0.4rem; padding: 1px">
                <template #header><i class="pi pi-database mx-auto"></i></template>
                <template #body="slotProps">
                    <div class="mx-auto">
                        <span>{{ slotProps.data.quantity }}</span>
                    </div>
                </template>
            </Column>
            <Column field="buyQuantity" style="max-width: 1rem; padding: 0.3rem">
                <template #header>Заказ</template>
                <template #body="slotProps">
                    <div class="grid grid-cols-3 gap-3 items-center justify-between max-w-24 sm:max-w-32">
                        <div v-if="purchaseOrder.isCreated" class="flex items-center">
                            <span>{{ slotProps.data.buyQuantity }}</span>
                        </div>
                        <div v-else-if="!purchaseOrder.isCompleted" class="flex items-center">
                            <InputText
                                type="number"
                                @input="
                                    (e) => {
                                        const value = e.target.value
                                        if (isNan(value)) {
                                            slotProps.data.buyQuantity = ''
                                        } else if (value < 0) {
                                            slotProps.data.buyQuantity = 0
                                        } else {
                                            slotProps.data.buyQuantity = value
                                        }
                                    }
                                "
                                :value="slotProps.data.buyQuantity"
                                :style="inputStyleObject"
                                size="small"
                                i
                            />
                        </div>
                        <div v-if="!purchaseOrder.isCompleted && purchaseOrder.isPaid && slotProps.data.receivedQuantity < slotProps.data.buyQuantity" class="flex items-center">
                            <InputText
                                type="number"
                                @input="
                                    (e) => {
                                        const value = e.target.value
                                        if (isNan(value)) {
                                            slotProps.data.confirmedQuantity = ''
                                        } else if (value < slotProps.data.receivedQuantity) {
                                            slotProps.data.confirmedQuantity = slotProps.data.receivedQuantity
                                        } else if (value > slotProps.data.buyQuantity) {
                                            slotProps.data.confirmedQuantity = slotProps.data.buyQuantity
                                        } else {
                                            slotProps.data.confirmedQuantity = value
                                        }
                                    }
                                "
                                :disabled="!props.editable"
                                :value="slotProps.data.confirmedQuantity"
                                :style="inputStyleObject"
                                size="small"
                            />
                        </div>
                    </div>
                </template>
            </Column>
            <Column field="price" header="Цена" style="max-width: 0.5rem; padding: 0.3rem">
                <template #body="slotProps">
                    {{ formatCurrency(slotProps.data.price * slotProps.data.buyQuantity) }}
                </template>
            </Column>
            <template #footer>
                <p class="text-right mr-10">
                    <b>{{ totalMessage }}</b>
                </p>

                <div v-if="props.editable" class="flex justify-end gap-4 my-3">
                    <Button v-if="!purchaseOrder.isPaid" label="Удалить" icon="pi pi-trash" severity="danger" @click="confirmDeleteDialog = true" />
                    <Button v-if="!purchaseOrder.isCreated" label="Создать" icon="pi pi-check" severity="success" @click="handleUpdatePurchaseOrder(true, false, false, false)" />
                    <Button v-if="!purchaseOrder.isPaid && purchaseOrder.isCreated && props.approvePayment" label="Оплатить" icon="pi pi-check" severity="success" @click="confirmPaidDialog = true" />
                    <Button v-else-if="!purchaseOrder.isCompleted && purchaseOrder.isCreated" :label="partialCompleted ? 'Частично получить' : 'Завершить'" icon="pi pi-check" @click="confirmCompeteDialog = true" />
                </div>
            </template>
        </DataTable>
        <Divider type="dashed" />
    </Dialog>

    <Dialog v-model:visible="confirmDeleteDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите отменить текущий заказ?</span>
        </div>
        <template #footer>
            <Button label="Нет" severity="secondary" icon="pi pi-times" text @click="confirmDeleteDialog = false" />
            <Button v-if="props.editable" severity="danger" label="Да" icon="pi pi-check" @click="deletePurchaseOrder()" />
        </template>
    </Dialog>

    <Dialog v-model:visible="confirmPaidDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что оплатили текущий заказ?</span>
        </div>
        <template #footer>
            <Button label="Закрыть" severity="secondary" icon="pi pi-times" text @click="confirmPaidDialog = false" />
            <Button v-if="props.editable && props.approvePayment" label="Оплатил" icon="pi pi-check" @click="handleUpdatePurchaseOrder(true, true, false, false)" />
        </template>
    </Dialog>

    <Dialog v-model:visible="confirmCompeteDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите {{ partialCompleted ? "частично получить" : "завершить" }} текущий заказ?</span>
        </div>
        <template #footer>
            <Button label="Закрыть" severity="secondary" icon="pi pi-times" text @click="confirmCompeteDialog = false" />
            <Button v-if="props.editable" label="Да" icon="pi pЦi-check" @click="handleUpdatePurchaseOrder(true, true, partialCompleted, !partialCompleted)" />
        </template>
    </Dialog>
</template>
