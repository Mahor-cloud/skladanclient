<script setup>
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { FilterMatchMode } from "@primevue/core/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"

const props = defineProps({
    visible: Boolean,
    inventorization: String,
    editable: Boolean
})

const toast = useToast()
const collapse = ref(false)
const inventorization = ref({})
const visible = ref(props.visible)
const message = ref("")
const saveInventorizationDialog = ref(false)
const deleteInventorizationDialog = ref(false)

const queryClient = useQueryClient()

const { isError, data, error, isSuccess, isFetching } = useQuery({
    queryKey: ["inventorization", props.inventorization],
    queryFn: async () => await axiosInstance.get(`inventory/${props.inventorization}`),
    select: (data) => data.data,
    enabled: !!props.inventorization,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { mutate: saveInventory } = useMutation({
    mutationKey: ["inventorization", props.inventorization],
    mutationFn: async (inventorization) => {
        const payload = { ...inventorization, items: inventorization.items.map((item) => ({ product: item._id, newQuantity: item.newQuantity, quantity: item.quantity })) }
        return await axiosInstance.put(`inventory/${props.inventorization}`, payload)
    },
    onSuccess: (data) => {
        queryClient.setQueryData(["inventorization", data.data._id], data)
        queryClient.invalidateQueries(["inventorizations"])
        data.data.value.isCompleted ? toast.add({ severity: "success", summary: "Успешно", detail: "Инвентаризация завершена", life: 3000 }) : toast.add({ severity: "success", summary: "Успешно", detail: "Инвентаризация сохранена", life: 3000 })

        inventorization.value = data.data.value
    }
})

const { mutate: deleteInventory } = useMutation({
    mutationKey: ["inventorization", props.inventorization],
    mutationFn: async () => {
        return await axiosInstance.delete(`inventory/${props.inventorization}`)
    },
    onSuccess: (data) => {
        queryClient.setQueryData(["inventorization", props.inventorization], {})
        queryClient.invalidateQueries(["inventorizations"])
        toast.add({ severity: "success", summary: "Успешно", detail: "Инвентаризация удалена", life: 3000 })
        inventorization.value = data.data.value
    }
})

const emit = defineEmits(["hideInventoryDialog"])

const categories = computed({
    get() {
        return Array.from(new Set(inventorization.value.items.map((item) => item.category))).map((category) => ({ category }))
    }
})

const amountQuantity = computed({
    get() {
        if (isSuccess.value) {
            return inventorization.value.items.reduce((acc, i) => acc + i.quantity * i.price, 0)
        }
        return false
    }
})

const amountNewQuantity = computed({
    get() {
        if (isSuccess.value) {
            return inventorization.value.items.reduce((acc, i) => acc + i.newQuantity * i.price, 0)
        }
    }
})

const getSeverity = computed({
    get() {
        if (amountQuantity.value === amountNewQuantity.value) {
            return "success"
        } else if (amountQuantity.value >= amountNewQuantity.value) {
            return "error"
        } else {
            return "warn"
        }
    }
})

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

watchEffect(() => {
    if (isSuccess.value) {
        inventorization.value = {
            ...data.value,
            items: [
                ...data.value.items.map((item) => ({
                    ...item.product,
                    newQuantity: item.newQuantity,
                    quantity: item.quantity
                }))
            ]
        }
    }
})

function saveInventorization(complete = false) {
    inventorization.value.isCompleted = complete

    saveInventory(inventorization.value)

    saveInventorizationDialog.value = false
    collapse.value = false
    emit("hideInventoryDialog")
}

function deleteInventorization() {
    deleteInventory(inventorization.value._id)
    deleteInventorizationDialog.value = false
    collapse.value = false
    emit("hideInventoryDialog")
}
</script>

<template>
    <Dialog v-model:visible="visible" :style="{ width: '100%', height: '100%' }" :modal="true" :header="`Инвентаризация от ${formatTimestamp(inventorization.startDate)}`" v-on:update:visible="emit('hideInventoryDialog')">
        <div class="flex flex-col items-center text-center">
            <Message class="justify-center mb-4" size="large" variant="simple" :severity="inventorization.isCompletedd ? 'severity' : 'warn'"> {{ inventorization.isCompleted ? "Завершена" : "В процессе" }}</Message>
        </div>
        <DataTable :paginator="!collapse" paginatorPosition="bottom" ref="dt" :value="inventorization.items" dataKey="_id" :rows="30" v-model:filters="filters" :globalFilterFields="['name', 'price', 'category']" filterDisplay="menu" show-gridlines>
            <template #header>
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <div>
                        <Button type="button" icon="pi pi-filter-slash" outlined @click="clearFilter()" />
                        <Button type="button" class="ml-2" :icon="collapse ? 'pi pi-plus' : 'pi pi-minus'" outlined @click="collapse = !collapse" />
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
            <div v-if="!collapse">
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
                <Column field="quantity" style="max-width: 1rem; padding: 0.3rem">
                    <template #header><i class="pi pi-database"></i></template>
                    <template #body="slotProps">
                        <div class="grid grid-cols-3 gap-3 items-center justify-between max-w-24 sm:max-w-32">
                            <div class="flex items-center">
                                <span>{{ slotProps.data.quantity }}</span>
                            </div>
                            <div v-if="!inventorization.isCompleted && props.editable" class="flex items-center">
                                <input type="number" v-model="slotProps.data.newQuantity" />
                                <!-- <InputNumber v-model="slotProps.data.newQuantity" :invalid="false" :useGrouping="false" :inputStyle="inputStyleObject" size="small" /> -->
                            </div>
                            <div class="flex items-center justify-center ml-8">
                                <Tag
                                    :severity="slotProps.data.quantity >= slotProps.data.newQuantity ? 'danger' : 'success'"
                                    v-if="slotProps.data.newQuantity !== null && slotProps.data.newQuantity - slotProps.data.quantity !== 0"
                                    :value="slotProps.data.newQuantity - slotProps.data.quantity > 0 ? `+${slotProps.data.newQuantity - slotProps.data.quantity}` : slotProps.data.newQuantity - slotProps.data.quantity"
                                />
                            </div>
                        </div>
                    </template>
                </Column>
                <Column v-if="inventorization.isCompleted" field="newQuantity" style="max-width: 0.2rem; padding: 1px">
                    <template #header>Итог</template>
                    <template #body="slotProps">
                        <div class="flex items-center">
                            <span>{{ slotProps.data.newQuantity }}</span>
                        </div>
                    </template>
                </Column>
            </div>
        </DataTable>
        <div class="flex flex-col items-center text-center">
            <Message class="justify-center" size="small" :severity="getSeverity" variant="simple">Сумма склада по итогам инвентаризации: {{ amountNewQuantity }} руб, разница {{ amountNewQuantity - amountQuantity }} руб</Message>
        </div>
        <Divider type="dashed" />
        <FloatLabel v-if="props.editable" variant="on">
            <Textarea :disabled="inventorization.isCompleted" v-model="inventorization.comment" rows="5" cols="30" style="resize: none; width: 100%" />
            <label>Комментарий</label>
        </FloatLabel>
        <template #footer>
            <Button v-if="!inventorization.isCompleted && props.editable" :disabled="inventorization.isCompleted" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteInventorizationDialog = true" />
            <Button v-if="!inventorization.isCompleted && props.editable" :disabled="inventorization.isCompleted" label="Сохранить" icon="pi pi-check" severity="success" @click="saveInventorization(false)" />
            <Button v-if="!inventorization.isCompleted && props.editable" :disabled="inventorization.isCompleted" label="Завершить" icon="pi pi-check" @click="saveInventorizationDialog = true" />
        </template>
    </Dialog>
    <Dialog v-model:visible="deleteInventorizationDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите удалить текущую <b> инвентаризацию </b>?</span>
        </div>
        <template #footer>
            <Button label="No" icon="pi pi-times" text @click="deleteInventorizationDialog = false" />
            <Button v-if="props.editable" label="Yes" icon="pi pi-check" @click="deleteInventorization" />
        </template>
    </Dialog>

    <Dialog v-model:visible="saveInventorizationDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите завершить текущую <b> инвентаризацию </b>?</span>
        </div>
        <template #footer>
            <Button label="No" icon="pi pi-times" text @click="saveInventorizationDialog = false" />
            <Button v-if="props.editable" label="Yes" icon="pi pi-check" @click="saveInventorization(true)" />
        </template>
    </Dialog>
</template>
