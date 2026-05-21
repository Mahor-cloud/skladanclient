<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { FilterMatchMode } from "@primevue/core/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"
const props = defineProps({
    visible: Boolean,
    order: String,
    editable: Boolean,
    approvePayment: Boolean
})
const emit = defineEmits(["hidePurchaseOrderDialog"])

const toast = useToast()

const visible = computed(() => props.visible)
const purchaseOrder = ref({})
const confirmDeleteDialog = ref(false)
const confirmPaidDialog = ref(false)
const confirmCompeteDialog = ref(false)
const confirmReceiveAllDialog = ref(false)
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

const _user = (() => {
    try {
        return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        return null
    }
})()
const _perms = _user?.role?.permissions || []
const canExceedTarget = !!_user?.isAdmin || _perms.includes("approve_target_exceed")
const targetExceedDialog = ref(false)

function targetCap(row) {
    const t = Number(row?.targetQty) || 0
    if (t <= 0) return Infinity
    return Math.max(t, Number(row?.originalBuyQty) || 0)
}
function overTarget(row) {
    if (canExceedTarget) return false
    const cap = targetCap(row)
    if (cap === Infinity) return false
    const planned = Number(row?.buyQuantity) || 0
    const stockAfter = (Number(row?.quantity) || 0) + (Number(row?.confirmedQuantity) || 0)
    return planned > cap || stockAfter > cap
}
const anyOverTarget = computed(() =>
    (purchaseOrder.value?.items || []).some((r) => overTarget(r))
)

const selectedAddProduct = ref(null)
const addableProducts = computed(() => {
    const present = new Set((purchaseOrder.value?.items || []).map((i) => String(i._id)))
    return (productsList.value || []).filter((p) => !present.has(String(p._id)))
})
function addProductRow() {
    const p = selectedAddProduct.value
    if (!p) return
    if ((purchaseOrder.value.items || []).some((i) => String(i._id) === String(p._id))) {
        selectedAddProduct.value = null
        return
    }
    purchaseOrder.value.items = [
        ...(purchaseOrder.value.items || []),
        {
            ...p,
            buyQuantity: 1,
            buyQuantitySort: 1,
            confirmedQuantity: 0,
            receivedQuantity: 0,
            originalBuyQty: 0
        }
    ]
    selectedAddProduct.value = null
}

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

const { data, isSuccess } = useQuery({
    queryKey: ["purchaseOrder", props.order],
    queryFn: async () => await axiosInstance.get(`/purchases/${props.order}`),
    select: (data) => data.data,
    enabled: !!props.order,
    staleTime: 1000 * 60 * 5
})

const { data: productsList } = useQuery({
    queryKey: ["products"],
    queryFn: async () => await axiosInstance.get("/products"),
    select: (d) => d.data,
    staleTime: 1000 * 60 * 5
})
const availableByProduct = computed(() => {
    const m = new Map()
    for (const p of productsList.value || []) m.set(String(p._id), Number(p.quantity) || 0)
    return m
})
function availableFor(item) {
    const id = String(item._id)
    return availableByProduct.value.has(id) ? availableByProduct.value.get(id) : Number(item.quantity) || 0
}

const { mutate: updatePurchaseOrder, isPending: isPurchaseSaving } = useMutation({
    mutationKey: ["purchaseOrder", props.order],
    mutationFn: async (data) => await axiosInstance.put(`/purchases/${props.order}`, data),
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["purchaseOrder", data.data._id] })
        queryClient.invalidateQueries({ queryKey: ["purchases"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        confirmPaidDialog.value = false
        confirmCompeteDialog.value = false
        confirmReceiveAllDialog.value = false
        toast.add({ severity: "success", summary: "Закупка обновлена", life: 2500 })
    },
    onError: (err) => {
        confirmPaidDialog.value = false
        confirmCompeteDialog.value = false
        confirmReceiveAllDialog.value = false
        const msg = err?.response?.data?.message
        if (msg === "TARGET_EXCEEDED") {
            targetExceedDialog.value = true
        } else {
            toast.add({
                severity: "error",
                summary: "Не удалось обновить закупку",
                detail: Array.isArray(msg) ? msg.join(", ") : msg || err.message,
                life: 6000
            })
        }

        queryClient.invalidateQueries({ queryKey: ["purchaseOrder", props.order] })
        queryClient.invalidateQueries({ queryKey: ["purchases"] })
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

                    buyQuantitySort: item.quantity,


                    originalBuyQty: item.quantity,
                    confirmedQuantity: item.confirmedQuantity,
                    receivedQuantity: item.confirmedQuantity
                }))
            ],
            status: data.value.isCompleted ? "Завершен" : data.value.partialCompleted ? "Частично завершен" : data.value.isPaid && data.value.isCreated ? "Ожидание получения" : data.value.isCreated ? "Ожидание оплаты" : "Новый"
        }
    }
})

function autofillToTargets() {
    let filled = 0
    for (const item of purchaseOrder.value.items || []) {
        const target = Number(item.targetQty) || 0
        const available = availableFor(item)
        if (target > 0 && available < target) {
            item.buyQuantity = target - available
            filled++
        }
    }
    if (filled > 0) {
        toast.add({ severity: "success", summary: "Автозаполнено", detail: `Заполнено позиций до цели: ${filled}`, life: 3000 })
    } else {
        toast.add({ severity: "info", summary: "Нечего заполнять", detail: "Все товары с целью уже на нужном уровне или цель не задана.", life: 4000 })
    }
}

const autofillSuggestions = computed(() => {
    const out = []
    for (const item of purchaseOrder.value?.items || []) {
        const target = Number(item.targetQty) || 0
        if (target <= 0) continue
        const available = availableFor(item)
        if (available < target) out.push({ _id: item._id, name: item.name, target, available, need: target - available })
    }
    return out
})

const autofillDialog = ref(false)
const autofillPromptShown = ref(false)
const autofillPromptKey = `purchase-autofill-prompted-${props.order}`

watchEffect(() => {
    if (autofillPromptShown.value) return
    if (!props.editable) return
    if (!isSuccess.value || !productsList.value) return
    if (purchaseOrder.value?.isCreated) return
    if (localStorage.getItem(autofillPromptKey)) {
        autofillPromptShown.value = true
        return
    }
    if (autofillSuggestions.value.length > 0) {
        autofillPromptShown.value = true
        localStorage.setItem(autofillPromptKey, "1")
        autofillDialog.value = true
    }
})

function applyAutofillFromDialog() {
    autofillToTargets()
    autofillDialog.value = false
}

function receiveAllProducts() {
    for (const item of purchaseOrder.value.items || []) {
        item.confirmedQuantity = item.buyQuantity
        item.receivedQuantity = item.buyQuantity
    }
    confirmReceiveAllDialog.value = false
    handleUpdatePurchaseOrder(true, true, false, true)
}

function onPurchaseSort() {
    for (const item of purchaseOrder.value.items || []) {
        item.buyQuantitySort = Number(item.buyQuantity) || 0
    }
}

function digitsToInt(v) {
    const d = String(v ?? "").replace(/\D+/g, "")
    const n = parseInt(d, 10)
    return Number.isFinite(n) ? n : NaN
}
function normalizeBuyQty(row) {
    const n = digitsToInt(row.buyQuantity)
    row.buyQuantity = Number.isFinite(n) && n > 0 ? n : 0
}
function normalizeConfirmedQty(row) {
    let n = digitsToInt(row.confirmedQuantity)
    if (!Number.isFinite(n)) n = row.receivedQuantity
    if (n < row.receivedQuantity) n = row.receivedQuantity
    else if (n > row.buyQuantity) n = row.buyQuantity
    row.confirmedQuantity = n
}

function commitActiveField() {
    const el = document.activeElement
    if (el && typeof el.blur === "function") el.blur()
}

function handleUpdatePurchaseOrder(isCreated, isPaid, partialCompleted, isCompleted) {
    commitActiveField()
    if (!purchaseOrder.value.isCreated && isCreated) {
        purchaseOrder.value.items = purchaseOrder.value.items.filter((item) => item.buyQuantity > 0 && item.confirmedQuantity == 0)
    }
    if (purchaseOrder.value.items.length == 0) {
        return emit("hidePurchaseOrderDialog")
    }
    const payload = {
        isCreated,
        isPaid,
        partialCompleted,
        isCompleted,
        items: purchaseOrder.value.items.map((item) => ({
            product: item._id,
            quantity: Number(item.buyQuantity) || 0,
            confirmedQuantity: Number(item.confirmedQuantity) || 0
        }))
    }
    if (typeof purchaseOrder.value.comment === "string") payload.comment = purchaseOrder.value.comment
    updatePurchaseOrder(payload)
}

function formatCurrency(value) {
    if (value) return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return
}
</script>

<template>
    <Dialog
        :breakpoints="{ '768px': '100vw' }"
        :style="{ width: '900px', height: '90vh' }"
        :header="`Закупка №${purchaseOrder?.purchaseNumber}, Заказчик: ${purchaseOrder?.user?.name}`"
        :visible="visible"
        :modal="true"
        @update:visible="emit('hidePurchaseOrderDialog')">
        <div class="flex flex-col items-center text-center">
            <Message class="justify-center mb-4" size="large" variant="simple"> {{ purchaseOrder.status }}</Message>
        </div>

        <Divider type="dashed" />

        <DataTable :value="purchaseOrder?.items" dataKey="_id" :default-sort-order="-1" @sort="onPurchaseSort" v-model:filters="filters" :globalFilterFields="['name', 'price', 'category']" filterDisplay="menu" show-gridlines>
            <template #header>
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <div>
                        <Button type="button" icon="pi pi-filter-slash" aria-label="Сбросить фильтры" outlined @click="clearFilter()" />
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
            <Column field="name" header="Название" style="min-width: 10rem; padding: 0.3rem"></Column>
            <Column header="Вид" field="category" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="min-width: 6rem; padding: 0.3rem">
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
            <Column field="quantity" style="min-width: 4rem; padding: 0.3rem">
                <template #header><i class="pi pi-database mx-auto"></i></template>
                <template #body="slotProps">
                    <div class="mx-auto">
                        <span>{{ slotProps.data.quantity }}</span>
                    </div>
                </template>
            </Column>
            <Column field="targetQty" style="min-width: 3.5rem; padding: 0.3rem">
                <template #header><span v-tooltip.top="'Цель по товару'">Цель</span></template>
                <template #body="slotProps">
                    <span :class="{ 'cs-over': overTarget(slotProps.data) }">{{ slotProps.data.targetQty || "—" }}</span>
                </template>
            </Column>
            <Column field="buyQuantity" :sortField="'buyQuantitySort'" sortable style="min-width: 8rem; padding: 0.3rem">
                <template #header>Заказ</template>
                <template #body="slotProps">
                    <div class="grid grid-cols-3 gap-3 items-center justify-between max-w-24 sm:max-w-32">
                        <div v-if="purchaseOrder.isCreated" class="flex items-center">
                            <span>{{ slotProps.data.buyQuantity }}</span>
                        </div>
                        <div v-else-if="!purchaseOrder.isCompleted" class="flex items-center">
                            <InputText
                                inputmode="numeric"
                                v-model="slotProps.data.buyQuantity"
                                @blur="normalizeBuyQty(slotProps.data)"
                                :style="inputStyleObject"
                                :class="{ 'cs-over-input': overTarget(slotProps.data) }"
                                v-tooltip.top="overTarget(slotProps.data) ? 'Превышение цели — нужно подтверждение администратора' : ''"
                                size="small"
                            />
                        </div>
                        <div v-if="!purchaseOrder.isCompleted && purchaseOrder.isPaid && slotProps.data.receivedQuantity < slotProps.data.buyQuantity" class="flex items-center">
                            <InputText
                                inputmode="numeric"
                                v-model="slotProps.data.confirmedQuantity"
                                @blur="normalizeConfirmedQty(slotProps.data)"
                                :disabled="!props.editable"
                                :style="inputStyleObject"
                                size="small"
                            />
                        </div>
                    </div>
                </template>
            </Column>
            <Column field="price" header="Цена" style="min-width: 5rem; padding: 0.3rem">
                <template #body="slotProps">
                    {{ formatCurrency(slotProps.data.price * slotProps.data.buyQuantity) }}
                </template>
            </Column>
            <template #footer>
                <p class="text-right mr-10">
                    <b>{{ totalMessage }}</b>
                </p>

                <div
                    v-if="props.editable && purchaseOrder.isCreated && !purchaseOrder.isPaid && addableProducts.length"
                    class="flex justify-end gap-2 my-3 flex-wrap items-center"
                >
                    <span class="text-sm text-muted-color">Добавить позицию:</span>
                    <Select
                        v-model="selectedAddProduct"
                        :options="addableProducts"
                        optionLabel="name"
                        filter
                        placeholder="Выберите товар"
                        style="min-width: 14rem"
                    />
                    <Button label="Добавить" icon="pi pi-plus" severity="secondary" :disabled="!selectedAddProduct" @click="addProductRow" />
                </div>

                <div v-if="props.editable || props.approvePayment" class="flex justify-end gap-4 my-3 flex-wrap">
                    <Button v-if="props.editable && !purchaseOrder.isCreated" label="Автозаполнить до целей" icon="pi pi-bolt" severity="help" outlined v-tooltip.top="'Заполнить количество = цель − доступно (склад минус активные заказы)'" @click="autofillToTargets" />
                    <Button v-if="props.editable && !purchaseOrder.isPaid" label="Удалить" icon="pi pi-trash" severity="danger" @click="confirmDeleteDialog = true" />
                    <Button v-if="props.editable && !purchaseOrder.isCreated" label="Создать" icon="pi pi-check" severity="success" @click="handleUpdatePurchaseOrder(true, false, false, false)" />
                    <Button v-if="!purchaseOrder.isPaid && purchaseOrder.isCreated && props.approvePayment" label="Оплатить" icon="pi pi-check" severity="success" @click="confirmPaidDialog = true" />
                    <template v-if="props.editable && purchaseOrder.isCreated && purchaseOrder.isPaid && !purchaseOrder.isCompleted">
                        <Button label="Принять все товары" icon="pi pi-check-circle" severity="success" outlined v-tooltip.top="'Все позиции получены полностью, расхождений нет — завершить закупку'" @click="confirmReceiveAllDialog = true" />
                        <Button :label="partialCompleted ? 'Частично получить' : 'Завершить'" icon="pi pi-check" @click="confirmCompeteDialog = true" />
                    </template>
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
            <Button v-if="props.approvePayment" label="Оплатил" icon="pi pi-check" @click="handleUpdatePurchaseOrder(true, true, false, false)" />
        </template>
    </Dialog>

    <Dialog v-model:visible="confirmCompeteDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите {{ partialCompleted ? "частично получить" : "завершить" }} текущий заказ?</span>
        </div>
        <template #footer>
            <Button label="Закрыть" severity="secondary" icon="pi pi-times" text :disabled="isPurchaseSaving" @click="confirmCompeteDialog = false" />
            <Button v-if="props.editable" label="Да" icon="pi pi-check" :loading="isPurchaseSaving" @click="handleUpdatePurchaseOrder(true, true, partialCompleted, !partialCompleted)" />
        </template>
    </Dialog>

    <Dialog v-model:visible="confirmReceiveAllDialog" :style="{ width: '95%', maxWidth: '480px' }" :breakpoints="{ '768px': '100vw' }" header="Принять все товары" :modal="true">
        <div class="flex items-start gap-4">
            <i class="pi pi-check-circle !text-3xl text-green-500" />
            <span>
                Подтвердите, что <b>все позиции получены полностью</b> и соответствуют закупке —
                расхождений нет. Принятое количество по каждому товару будет приравнено к
                заказанному, и закупка <b>завершится</b>. Остатки склада пополнятся.
            </span>
        </div>
        <template #footer>
            <Button label="Отмена" severity="secondary" icon="pi pi-times" text @click="confirmReceiveAllDialog = false" />
            <Button v-if="props.editable" label="Да, принять все" icon="pi pi-check" severity="success" @click="receiveAllProducts" />
        </template>
    </Dialog>

    <Dialog v-model:visible="targetExceedDialog" :style="{ width: '95%', maxWidth: '480px' }" :breakpoints="{ '768px': '100vw' }" header="Превышение цели" :modal="true">
        <div class="flex items-start gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl text-orange-500" />
            <span>
                Количество превышает цель по товару, а у вас нет права подтверждать
                превышение. Для превышения цели обратитесь к администратору за
                повышением прав или подтверждением превышения — закупку с превышением
                цели создаёт администратор.
            </span>
        </div>
        <template #footer>
            <Button label="Понятно" icon="pi pi-check" @click="targetExceedDialog = false" />
        </template>
    </Dialog>

    <Dialog
        v-model:visible="autofillDialog"
        :breakpoints="{ '768px': '100vw' }"
        :style="{ width: '640px' }"
        header="Автозаполнение закупки"
        :modal="true">
        <p class="mb-3">
            Эти товары ниже цели с учётом активных заказов. Заполнить количество к закупке автоматически
            (цель − доступно)?
        </p>
        <DataTable :value="autofillSuggestions" size="small" scrollable scrollHeight="50vh" show-gridlines>
            <Column field="name" header="Товар" style="min-width: 10rem; padding: 0.3rem" />
            <Column field="target" header="Цель" style="min-width: 4rem; padding: 0.3rem" />
            <Column field="available" header="Доступно" style="min-width: 5rem; padding: 0.3rem" />
            <Column header="К закупке" style="min-width: 5rem; padding: 0.3rem">
                <template #body="{ data }">
                    <Tag :value="data.need" severity="warn" />
                </template>
            </Column>
        </DataTable>
        <template #footer>
            <Button label="Не сейчас" severity="secondary" icon="pi pi-times" text @click="autofillDialog = false" />
            <Button label="Заполнить" icon="pi pi-bolt" severity="help" @click="applyAutofillFromDialog" />
        </template>
    </Dialog>
</template>

<style scoped>
.cs-over {
    color: #dc2626;
    font-weight: 700;
}
.cs-over-input :deep(input),
.cs-over-input.p-inputtext {
    border-color: #dc2626 !important;
    background: rgba(220, 38, 38, 0.08);
}
</style>
