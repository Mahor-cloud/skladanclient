<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
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

const visible = computed(() => props.visible)
const message = ref("")
const saveInventorizationDialog = ref(false)
const deleteInventorizationDialog = ref(false)
const editReasonDialog = ref(false)
const editReasonAction = ref(null)
const editReason = ref("")

const queryClient = useQueryClient()

const { isError, data, error, isSuccess, isFetching } = useQuery({
    queryKey: ["inventorization", props.inventorization],
    queryFn: async () => await axiosInstance.get(`inventory/${props.inventorization}`),
    select: (data) => data.data,
    enabled: !!props.inventorization,
    refetchOnMount: "always",
    staleTime: 0,
    refetchInterval: 1000 * 60 * 5
})

const { mutate: saveInventory } = useMutation({
    mutationKey: ["inventorization", props.inventorization],
    mutationFn: async (inventorization) => {
        const payload = {
            items: inventorization.items.map((item) => ({
                product: item._id,
                newQuantity: Number(item.newQuantity) || 0,
                quantity: Number(item.quantity) || 0
            }))
        }
        if (typeof inventorization.isCompleted === "boolean") payload.isCompleted = inventorization.isCompleted
        if (typeof inventorization.comment === "string") payload.comment = inventorization.comment
        if (inventorization.editReason) payload.editReason = inventorization.editReason
        return await axiosInstance.put(`inventory/${props.inventorization}`, payload)
    },
    onSuccess: (data) => {
        queryClient.setQueryData(["inventorization", props.inventorization], data)
        queryClient.invalidateQueries({ queryKey: ["inventorizations"] })
        queryClient.invalidateQueries({ queryKey: ["inventorization", props.inventorization] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        toast.add({ severity: "success", summary: "Успешно", detail: "Изменения сохранены", life: 3000 })
    },
    onError: (e) => {
        toast.add({
            severity: "error",
            summary: "Ошибка",
            detail: e?.response?.data?.message || e.message,
            life: 5000
        })
    }
})

const { mutate: deleteInventory } = useMutation({
    mutationKey: ["inventorization", props.inventorization],
    mutationFn: async (editReason) => {
        return await axiosInstance.delete(`inventory/${props.inventorization}`, {
            data: editReason ? { editReason } : undefined
        })
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["inventorizations"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        toast.add({ severity: "success", summary: "Успешно", detail: "Инвентаризация удалена", life: 3000 })
        emit("hideInventoryDialog")
    },
    onError: (e) => {
        toast.add({
            severity: "error",
            summary: "Ошибка",
            detail: e?.response?.data?.message || e.message,
            life: 5000
        })
    }
})

const emit = defineEmits(["hideInventoryDialog"])

const categories = computed({
    get() {

        const items = inventorization.value?.items || []
        return Array.from(new Set(items.map((item) => item.category))).map((category) => ({ category }))
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
    minWidth: "56px",
    height: "40px",
    padding: "4px 6px",
    textAlign: "center",
    fontSize: "16px"
}

watchEffect(() => {
    if (isSuccess.value) {
        inventorization.value = {
            ...data.value,
            items: [
                ...data.value.items.map((item) => ({
                    ...item.product,
                    newQuantity: item.newQuantity,
                    quantity: item.quantity,
                    deviation: (item.newQuantity || 0) - (item.quantity || 0),
                    sortSnapshot: Math.abs((item.newQuantity || 0) - (item.quantity || 0))
                }))
            ]
        }
    }
})

function onInventorySort() {
    for (const it of inventorization.value.items || []) {
        it.sortSnapshot = Math.abs((Number(it.newQuantity) || 0) - (Number(it.quantity) || 0))
    }
}

function requestSaveCompleted() {
    editReasonAction.value = "save"
    editReason.value = ""
    editReasonDialog.value = true
}

function requestDeleteCompleted() {
    editReasonAction.value = "delete"
    editReason.value = ""
    editReasonDialog.value = true
}

function confirmEditReason() {
    if (!editReason.value || !editReason.value.trim()) {
        toast.add({
            severity: "warn",
            summary: "Внимание",
            detail: "Укажите причину изменения завершённой инвентаризации",
            life: 3000
        })
        return
    }
    if (editReasonAction.value === "save") {
        const payload = { ...inventorization.value, editReason: editReason.value.trim() }
        saveInventory(payload)
        collapse.value = false
        editReasonDialog.value = false
        emit("hideInventoryDialog")
    } else if (editReasonAction.value === "delete") {
        deleteInventory(editReason.value.trim())
        editReasonDialog.value = false
        collapse.value = false
        emit("hideInventoryDialog")
    }
}

function saveInventorization(complete = false) {

    const el = document.activeElement
    if (el && typeof el.blur === "function") el.blur()
    if (inventorization.value.isCompleted) {
        requestSaveCompleted()
        return
    }
    inventorization.value.isCompleted = complete

    saveInventory(inventorization.value)

    saveInventorizationDialog.value = false
    collapse.value = false
    emit("hideInventoryDialog")
}

function deleteInventorization() {
    if (inventorization.value.isCompleted) {
        deleteInventorizationDialog.value = false
        requestDeleteCompleted()
        return
    }
    deleteInventory(null)
    deleteInventorizationDialog.value = false
    collapse.value = false
    emit("hideInventoryDialog")
}
</script>

<template>
    <Dialog
        :visible="visible"
        :breakpoints="{ '768px': '100vw' }"
        :style="{ width: '900px', height: '90vh' }"
        :modal="true"
        :header="`Инвентаризация от ${formatTimestamp(inventorization.startDate)}`"
        @update:visible="emit('hideInventoryDialog')">
        <div class="flex flex-col items-center text-center">
            <Message class="justify-center mb-4" size="large" variant="simple" :severity="inventorization.isCompleted ? 'success' : 'warn'"> {{ inventorization.isCompleted ? "Завершена" : "В процессе" }}</Message>
        </div>
        <DataTable :paginator="!collapse" paginatorPosition="bottom" ref="dt" :value="inventorization.items" dataKey="_id" :rows="30" :defaultSortOrder="-1" @sort="onInventorySort" v-model:filters="filters" :globalFilterFields="['name', 'price', 'category']" filterDisplay="menu" show-gridlines>
            <template #header>
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <div>
                        <Button type="button" icon="pi pi-filter-slash" aria-label="Сбросить фильтры" outlined @click="clearFilter()" />
                        <Button type="button" class="ml-2" :icon="collapse ? 'pi pi-plus' : 'pi pi-minus'" :aria-label="collapse ? 'Развернуть' : 'Свернуть'" outlined @click="collapse = !collapse" />
                    </div>
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
            <Column v-if="!collapse" field="name" header="Название" style="min-width: 8rem; padding: 0.3rem"></Column>
            <Column v-if="!collapse" header="Вид" field="category" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="min-width: 6rem; padding: 0.3rem">
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
            <Column v-if="!collapse" field="quantity" style="min-width: 8rem; padding: 0.3rem">
                <template #header><i class="pi pi-database"></i></template>
                <template #body="slotProps">
                    <div class="flex items-center gap-3">
                        <div class="flex items-center">
                            <span>{{ slotProps.data.quantity }}</span>
                        </div>
                        <div v-if="props.editable" class="flex items-center">
                            <InputText
                                inputmode="numeric"
                                v-model="slotProps.data.newQuantity"
                                @blur="
                                    () => {
                                        let raw = String(slotProps.data.newQuantity ?? '').replace(/[^\d-]/g, '').replace(/(?!^)-/g, '')
                                        const n = parseInt(raw, 10)
                                        slotProps.data.newQuantity = Number.isFinite(n) ? n : ''
                                        slotProps.data.deviation = (Number(slotProps.data.newQuantity) || 0) - (Number(slotProps.data.quantity) || 0)
                                    }
                                "
                                :style="inputStyleObject"
                            />
                        </div>
                    </div>
                </template>
            </Column>
            <Column v-if="!collapse" field="deviation" :sortField="'sortSnapshot'" sortable style="min-width: 6rem; padding: 0.3rem">
                <template #header>
                    <span v-tooltip.top="'Отклонение: итог − склад. Сортировка — по величине расхождения.'" style="font-size: 1.1rem; font-weight: 700">Σ</span>
                </template>
                <template #body="slotProps">
                    <Tag
                        v-if="slotProps.data.deviation !== 0 && slotProps.data.newQuantity !== '' && slotProps.data.newQuantity !== null"
                        :severity="slotProps.data.deviation > 0 ? 'success' : 'danger'"
                        :value="slotProps.data.deviation > 0 ? `+${slotProps.data.deviation}` : `${slotProps.data.deviation}`"
                    />
                    <span v-else>0</span>
                </template>
            </Column>
            <Column v-if="!collapse && inventorization.isCompleted && !props.editable" field="newQuantity" style="min-width: 4rem; padding: 0.3rem">
                <template #header>Итог</template>
                <template #body="slotProps">
                    <div class="flex items-center">
                        <span>{{ slotProps.data.newQuantity }}</span>
                    </div>
                </template>
            </Column>
        </DataTable>
        <div class="flex flex-col items-center text-center">
            <Message class="justify-center" size="small" :severity="getSeverity" variant="simple">Сумма склада по итогам инвентаризации: {{ amountNewQuantity }} руб, разница {{ amountNewQuantity - amountQuantity }} руб</Message>
        </div>
        <Divider type="dashed" />
        <FloatLabel v-if="props.editable" variant="on">
            <Textarea v-model="inventorization.comment" rows="5" cols="30" style="resize: none; width: 100%" />
            <label>Комментарий</label>
        </FloatLabel>
        <Message v-if="inventorization.isCompleted && props.editable" severity="info" class="mt-3" :closable="false">
            Эта инвентаризация завершена. Любое изменение или удаление потребует указать причину и пересчитает остатки на складе.
        </Message>
        <template #footer>
            <Button v-if="props.editable" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteInventorizationDialog = true" />
            <Button v-if="props.editable && inventorization.isCompleted" label="Сохранить" icon="pi pi-check" severity="warn" @click="saveInventorization(true)" />
            <Button v-if="props.editable && !inventorization.isCompleted" label="Сохранить" icon="pi pi-check" severity="success" @click="saveInventorization(false)" />
            <Button v-if="props.editable && !inventorization.isCompleted" label="Завершить" icon="pi pi-check" @click="saveInventorizationDialog = true" />
        </template>
    </Dialog>
    <Dialog v-model:visible="deleteInventorizationDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите удалить текущую <b> инвентаризацию </b>?</span>
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="deleteInventorizationDialog = false" />
            <Button v-if="props.editable" label="Да" icon="pi pi-check" @click="deleteInventorization" />
        </template>
    </Dialog>

    <Dialog v-model:visible="saveInventorizationDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите завершить текущую <b> инвентаризацию </b>?</span>
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="saveInventorizationDialog = false" />
            <Button v-if="props.editable" label="Да" icon="pi pi-check" @click="saveInventorization(true)" />
        </template>
    </Dialog>

    <Dialog v-model:visible="editReasonDialog" :style="{ width: '480px' }" :header="editReasonAction === 'delete' ? 'Удаление завершённой инвентаризации' : 'Изменение завершённой инвентаризации'" :modal="true">
        <div class="flex flex-col gap-3">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle !text-2xl text-orange-500" />
                <span>
                    <template v-if="editReasonAction === 'delete'">
                        Удаление завершённой инвентаризации <b>откатит</b> её эффект на остатки склада.
                    </template>
                    <template v-else>
                        Изменение завершённой инвентаризации <b>пересчитает</b> остатки склада на разницу новых значений.
                    </template>
                    Укажите причину — она будет сохранена в истории изменений.
                </span>
            </div>
            <FloatLabel variant="on">
                <Textarea v-model="editReason" rows="4" style="resize: none; width: 100%" maxlength="500" />
                <label>Причина изменения</label>
            </FloatLabel>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" text @click="editReasonDialog = false" />
            <Button :label="editReasonAction === 'delete' ? 'Удалить' : 'Сохранить'" :icon="editReasonAction === 'delete' ? 'pi pi-trash' : 'pi pi-check'" :severity="editReasonAction === 'delete' ? 'danger' : 'warn'" @click="confirmEditReason" />
        </template>
    </Dialog>
</template>
