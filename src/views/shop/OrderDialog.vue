<script setup>
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"
const props = defineProps({
    order: String,
    visible: Boolean,
    readonly: { type: Boolean, default: false }
})
const emit = defineEmits(["hideOrderDialog"])

const queryClient = useQueryClient()
const toast = useToast()

const order = ref({})

const visible = computed(() => props.visible)
const confirmDeleteOrderDialog = ref(false)
const payDialog = ref(false)
const finalConfirmedDialog = ref(false)
const editMode = ref(false)
const editItems = ref([])
const editReason = ref("")
const addProductId = ref(null)
const addProductQty = ref(1)
const reasonRequired = ref(false)

const headerMessage = ref("")
const footerMessage = ref("")
const statusMessage = ref("")
const user = ref(JSON.parse(localStorage.getItem("user") || "null"))

const { data: msgsData, isSuccess: isMsgsSuccess } = useQuery({
    queryKey: ["msgs"],
    queryFn: async () => await axiosInstance.get("/database/msg"),
    select: (data) => data.data || { paymentMessage: "", receiveMessage: "" },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: async () => await axiosInstance.get("/products"),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    enabled: computed(() => editMode.value)
})

const { data, isSuccess } = useQuery({
    queryKey: ["order", props.order],
    queryFn: async () => await axiosInstance.get(`/orders/${props.order}`),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})
const { data: shortagesData } = useQuery({
    queryKey: ["orderShortages"],
    queryFn: async () => (await axiosInstance.get("/orders/shortages")).data,
    staleTime: 30_000
})
const orderShortages = computed(() => {
    const id = order.value?._id
    if (!id || !shortagesData.value) return []
    return shortagesData.value.filter((s) => s.orderIds.includes(String(id)))
})
const orderBlocked = computed(() => orderShortages.value.length > 0)

const { mutate: deleteOrder, isPending: isDeletingOrder } = useMutation({
    mutationKey: ["deleteOrder", props.order],
    mutationFn: async () => await axiosInstance.delete(`/orders/${props.order}`),
    onSuccess: () => {

        queryClient.setQueryData(["order", props.order], {})
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })

        queryClient.invalidateQueries({ queryKey: ["orderShortages"] })

        emit("hideOrderDialog")
    }
})

const { mutate: updateOrder, isPending: isUpdatingOrder } = useMutation({
    mutationKey: ["updateOrder", props.order],
    mutationFn: async (data) => await axiosInstance.put(`/orders/${props.order}`, data),
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["order", data.data._id] })
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        queryClient.invalidateQueries({ queryKey: ["orderShortages"] })

        payDialog.value = false
        finalConfirmedDialog.value = false
    },
    onError: (e) => {
        const data = e?.response?.data

        if (data?.code === "INSUFFICIENT_STOCK") return
        if (data?.code === "STOCK_SHORTAGE") {
            finalConfirmedDialog.value = false
            queryClient.invalidateQueries({ queryKey: ["orderShortages"] })
            toast.add({ severity: "warn", summary: "Дефицит по складу", detail: data.message, life: 8000 })
            return
        }
        const detail = (typeof data?.message === "string" ? data.message : null) || e?.message || "Не удалось обновить заказ"
        toast.add({ severity: "error", summary: "Ошибка", detail, life: 6000 })
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        order.value = {
            ...data.value,
            items: [
                ...data.value.items.map((item) => ({
                    ...item.product,
                    buyQuantity: item.quantity,

                    buyQuantitySort: item.quantity
                }))
            ]
        }
        headerMessage.value = `Заказ номер ${order.value.orderNumber}, Заказчик: ${order.value.user.name}`
        footerMessage.value = `Итого: ${order.value.items.reduce((acc, item) => acc + item.price * item.buyQuantity, 0)}`
        statusMessage.value = order.value.isCompleted
            ? "Завершен"
            : !order.value.isPaid && !order.value.confirmedPaid
              ? "Заказ ожидает оплаты"
              : order.value.confirmedPaid && !order.value.isCompleted
                ? "Заказ ожидает получения"
                : "Заказ ожидает подтверждения оплаты казначеем"
    }
})
const orderCreator = computed({
    get() {
        return order.value?.user?._id === user.value._id
    }
})
const approvePaymentRole = computed({
    get() {
        return user.value?.isAdmin || user.value?.role?.permissions?.includes("approve-payment")
    }
})

const canMarkPaid = computed(
    () => orderCreator.value || user.value?.isAdmin || user.value?.role?.permissions?.includes("edit_orders")
)

const isMainAdmin = computed(
    () => user.value?.role?.isSystem === true || user.value?.role?.name === "Admin"
)

const canEditItems = computed(() => {
    if (!order.value) return false
    if (order.value.isCompleted) {

        return isMainAdmin.value
    }
    const isOwner = orderCreator.value
    const canEditOrdersPerm = user.value?.isAdmin || user.value?.role?.permissions?.includes("edit_orders")

    if (isOwner && !order.value.isPaid) return true

    if (isOwner && order.value.isPaid && !order.value.confirmedPaid) return true

    if (canEditOrdersPerm) return true
    return false
})

const isPaidAlready = computed(() => !!order.value?.isPaid)

const editTotal = computed(() => {
    if (!editItems.value.length) return 0
    return editItems.value.reduce((acc, it) => acc + (it.price || 0) * (it.buyQuantity || 0), 0)
})

const editDiff = computed(() => {
    const paid = order.value?.paidAmount || 0
    if (!isPaidAlready.value) return 0
    return editTotal.value - paid
})

const pendingPaymentEvent = computed(() => {
    const evs = order.value?.paymentEvents || []
    for (let i = evs.length - 1; i >= 0; i--) {
        if (evs[i].type === "surcharge-pending" || evs[i].type === "refund-pending") return evs[i]
        if (evs[i].type === "payment-confirmed") return null
    }
    return null
})
const orderHasPendingDiff = computed(() => {
    if (!order.value || !order.value.isPaid || order.value.confirmedPaid) return 0
    const ev = pendingPaymentEvent.value
    if (ev) return ev.amount || 0
    return 0
})
const orderTotalToPay = computed(() => order.value?.totalAmount || 0)

const availableProductsForAdd = computed(() => {
    if (!productsData.value) return []
    const usedIds = new Set(editItems.value.map((it) => String(it._id)))
    return productsData.value.filter((p) => !usedIds.has(String(p._id)) && !p.deletedAt)
})

function maxQtyForProduct(productId) {
    const p = productsData.value?.find((x) => String(x._id) === String(productId))
    if (!p) return 9999
    const available = Number(p.quantity ?? p.totalQuantity ?? 0)
    const origInOrder = (order.value?.items || []).find((i) => String(i._id) === String(productId))?.buyQuantity || 0
    return Math.max(0, available + origInOrder)
}

const paymentEventLabel = (type) => {
    switch (type) {
        case "paid":
            return "Заказчик отметил оплату"
        case "payment-confirmed":
            return "Казначей подтвердил оплату"
        case "items-changed":
            return "Изменены позиции заказа"
        case "surcharge-pending":
            return "Требуется доплата"
        case "refund-pending":
            return "Требуется возврат"
        case "surcharge-confirmed":
            return "Доплата подтверждена"
        case "refund-confirmed":
            return "Возврат подтверждён"
        default:
            return type
    }
}

const paymentEventSeverity = (type) => {
    if (type === "payment-confirmed" || type === "paid" || type === "surcharge-confirmed" || type === "refund-confirmed") return "success"
    if (type === "surcharge-pending") return "warn"
    if (type === "refund-pending") return "info"
    return "secondary"
}

function enterEditMode() {
    editItems.value = (order.value.items || []).map((it) => ({ ...it }))
    editReason.value = ""
    addProductId.value = null
    addProductQty.value = 1

    reasonRequired.value = isPaidAlready.value || !!order.value?.isCompleted
    editMode.value = true
}

const allowOverStock = computed(() => isMainAdmin.value && !!order.value?.isCompleted)

function cancelEdit() {
    editMode.value = false
    editItems.value = []
    editReason.value = ""
    addProductId.value = null
    addProductQty.value = 1
}

function removeEditItem(productId) {
    editItems.value = editItems.value.filter((it) => String(it._id) !== String(productId))
}

function addEditItem() {
    if (!addProductId.value || addProductQty.value < 1) {
        toast.add({ severity: "warn", summary: "Внимание", detail: "Выберите товар и укажите количество", life: 3000 })
        return
    }
    const product = productsData.value?.find((p) => String(p._id) === String(addProductId.value))
    if (!product) return
    if (editItems.value.some((it) => String(it._id) === String(product._id))) {
        toast.add({ severity: "warn", summary: "Внимание", detail: "Товар уже в заказе", life: 3000 })
        return
    }

    const maxAvail = maxQtyForProduct(product._id)
    if (maxAvail <= 0) {
        toast.add({ severity: "warn", summary: "Нет на складе", detail: `«${product.name}» сейчас недоступен (на складе 0).`, life: 5000 })
        return
    }
    if (addProductQty.value > maxAvail) {
        toast.add({ severity: "warn", summary: "Недостаточно на складе", detail: `«${product.name}»: доступно максимум ${maxAvail} шт. Количество уменьшено до ${maxAvail}.`, life: 5000 })
        editItems.value.push({ ...product, buyQuantity: maxAvail, buyQuantitySort: maxAvail })
        addProductId.value = null
        addProductQty.value = 1
        return
    }
    editItems.value.push({ ...product, buyQuantity: addProductQty.value, buyQuantitySort: addProductQty.value })
    addProductId.value = null
    addProductQty.value = 1
}

function onEditQtyBlur(row) {

    let v = parseInt(String(row.buyQuantity ?? "").replace(/\D+/g, ""), 10)
    if (!Number.isFinite(v) || v < 1) v = 1

    if (allowOverStock.value) {
        row.buyQuantity = v
        return
    }
    const max = maxQtyForProduct(row._id)
    if (v > max) {
        v = max
        toast.add({
            severity: "warn",
            summary: "Недостаточно на складе",
            detail: `«${row.name}»: доступно максимум ${max} шт. Количество уменьшено до ${max}.`,
            life: 4500
        })
    }
    row.buyQuantity = v
}

function commitActiveField() {
    const el = document.activeElement
    if (el && typeof el.blur === "function") el.blur()
}

function onOrderSort() {
    const list = editMode.value ? editItems.value : order.value?.items || []
    for (const it of list) it.buyQuantitySort = Number(it.buyQuantity) || 0
}

function saveEdits() {
    commitActiveField()

    for (const it of editItems.value) {
        let q = parseInt(it.buyQuantity, 10)
        if (!Number.isFinite(q) || q < 1) q = 1
        it.buyQuantity = q
    }
    if (!editItems.value.length) {
        toast.add({ severity: "warn", summary: "Внимание", detail: "Заказ не может быть пустым", life: 4000 })
        return
    }
    if (reasonRequired.value && !editReason.value?.trim()) {
        toast.add({ severity: "warn", summary: "Внимание", detail: "Укажите причину изменения оплаченного заказа", life: 4000 })
        return
    }
    const payload = {
        items: editItems.value.map((it) => ({ product: it._id, quantity: Number(it.buyQuantity) || 1 }))
    }
    if (typeof order.value.comment === "string") payload.comment = order.value.comment
    if (editReason.value?.trim()) payload.editReason = editReason.value.trim()
    updateOrder(payload, {
        onSuccess: () => {
            editMode.value = false
            editReason.value = ""
            toast.add({ severity: "success", summary: "Успешно", detail: "Позиции заказа обновлены", life: 3000 })
        },
        onError: (e) => {
            const d = e?.response?.data
            if (d?.code === "INSUFFICIENT_STOCK") {

                const row = editItems.value.find((it) => String(it._id) === String(d.product))
                if (row) row.buyQuantity = Math.max(1, Number(d.available) || 0)
                toast.add({
                    severity: "warn",
                    summary: "Недостаточно на складе",
                    detail: `«${d.productName}»: запрошено ${d.requested}, доступно ${d.available}. Количество подрезано до ${d.available}. Проверьте и сохраните снова.`,
                    life: 7000
                })
            }

        }
    })
}

function handleUpdateOrder(isPaid, confirmedPaid, isCompleted) {
    commitActiveField()
    const payload = {
        isPaid,
        confirmedPaid,
        isCompleted,
        items: (order.value.items || []).map((item) => ({
            product: item._id,
            quantity: Number(item.buyQuantity) || 1
        }))
    }
    if (typeof order.value.comment === "string") payload.comment = order.value.comment
    updateOrder(payload)
}

function formatCurrency(value) {
    if (value) return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return
}

async function printInvoice() {
    const { generateInvoice } = await import("./invoice")
    generateInvoice({
        ...order.value,
        totalPrice: footerMessage.value,
        orderDate: formatTimestamp(order.value.orderDate)
    })
}
</script>
<template>
    <Dialog
        :visible="visible"
        :breakpoints="{ '768px': '100vw' }"
        :style="{ width: '720px', height: '90vh' }"
        :modal="true"
        :header="headerMessage"
        v-on:update:visible="emit('hideOrderDialog')">
        <DataTable size="small" paginatorPosition="bottom" ref="dt" :value="editMode ? editItems : order.items" dataKey="_id" :rows="30" :default-sort-order="-1" @sort="onOrderSort" filterDisplay="menu" show-gridlines>
            <template #header>
                <Message severity="info"><b>Текущий статус:</b> {{ statusMessage }}</Message>
                <Message v-if="orderHasPendingDiff > 0" severity="warn" class="mt-2">
                    Всего к оплате <b>{{ formatCurrency(orderTotalToPay) }}</b>. Если предыдущий заказ уже оплачен — доплатить <b>{{ formatCurrency(orderHasPendingDiff) }}</b>. Казначей должен повторно подтвердить оплату.
                </Message>
                <Message v-else-if="orderHasPendingDiff < 0" severity="info" class="mt-2">
                    Всего к оплате <b>{{ formatCurrency(orderTotalToPay) }}</b>. Сумма уменьшилась — возврат <b>{{ formatCurrency(Math.abs(orderHasPendingDiff)) }}</b>. Казначей должен подтвердить возврат.
                </Message>
                <Message v-if="orderBlocked" severity="error" class="mt-2">
                    Заказ нельзя завершить — дефицит по складу:
                    <span v-for="s in orderShortages" :key="s.product">«<b>{{ s.productName }}</b>» (требуется {{ s.required }}, на складе {{ s.inStock }}); </span>
                    пополните склад или скорректируйте заказы.
                </Message>
            </template>
            <Column field="name" header="Название" style="min-width: 10rem; padding: 0.3rem">
                <template #body="slotProps">
                    <span>{{ slotProps.data.name }}</span>
                </template>
            </Column>
            <Column header="Кол-во" field="buyQuantity" :sortField="'buyQuantitySort'" sortable style="min-width: 6rem; padding: 0.3rem">
                <template #body="slotProps">
                    <InputText
                        v-if="editMode"
                        inputmode="numeric"
                        v-model="slotProps.data.buyQuantity"
                        @blur="onEditQtyBlur(slotProps.data)"
                        :style="{ width: '72px', textAlign: 'center', fontSize: '16px', minHeight: '40px' }"
                    />
                    <span v-else>{{ slotProps.data.buyQuantity }}</span>
                </template>
            </Column>
            <Column field="price" header="Сумма" style="min-width: 5rem; padding: 0.3rem">
                <template #body="slotProps">
                    {{ formatCurrency(slotProps.data.price * slotProps.data.buyQuantity) }}
                </template>
            </Column>
            <Column v-if="editMode" header="" style="min-width: 3rem; padding: 0.3rem">
                <template #body="slotProps">
                    <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeEditItem(slotProps.data._id)" />
                </template>
            </Column>
            <template #footer>
                <p class="text-right mr-10">
                    <b v-if="editMode">Итого: {{ formatCurrency(editTotal) }}</b>
                    <b v-else>{{ footerMessage }}</b>
                </p>

                <div v-if="editMode" class="order-edit-add mt-3">
                    <div class="order-edit-add__field">
                        <label class="text-sm block mb-1">Добавить товар</label>
                        <Select
                            v-model="addProductId"
                            :options="availableProductsForAdd"
                            option-label="name"
                            option-value="_id"
                            placeholder="Выберите товар"
                            filter
                            class="w-full"
                        />
                    </div>
                    <div class="order-edit-add__qty">
                        <label class="text-sm block mb-1">Кол-во</label>
                        <InputNumber v-model="addProductQty" :min="1" :max="addProductId ? maxQtyForProduct(addProductId) : 9999" :inputStyle="{ width: '72px', textAlign: 'center', fontSize: '16px', minHeight: '40px' }" />
                    </div>
                    <Button icon="pi pi-check" severity="success" rounded aria-label="Добавить" v-tooltip.top="'Добавить товар'" class="order-edit-add__btn" @click="addEditItem" />
                </div>

                <div v-if="editMode" class="flex flex-col gap-3 mt-3">
                    <Message v-if="order.isCompleted" severity="warn">
                        Редактирование <b>завершённого</b> заказа. Склад будет пересчитан на разницу:
                        уменьшение количества вернёт товар на склад, увеличение — спишет дополнительно.
                        Укажите причину.
                    </Message>
                    <div v-if="reasonRequired">
                        <FloatLabel variant="on">
                            <Textarea v-model="editReason" rows="3" style="resize: none; width: 100%" maxlength="500" />
                            <label>Причина изменения (обязательно)</label>
                        </FloatLabel>
                    </div>

                    <Message v-if="isPaidAlready && editDiff > 0" severity="warn">
                        Всего к оплате <b>{{ formatCurrency(editTotal) }}</b>. Если предыдущая сумма уже оплачена — потребуется доплатить <b>{{ formatCurrency(editDiff) }}</b>. Подтверждение оплаты будет сброшено.
                    </Message>
                    <Message v-else-if="isPaidAlready && editDiff < 0" severity="info">
                        Всего к оплате <b>{{ formatCurrency(editTotal) }}</b>. Сумма уменьшилась — потребуется возврат <b>{{ formatCurrency(Math.abs(editDiff)) }}</b>.
                    </Message>
                </div>

                <div v-if="!readonly && (orderCreator || user.isAdmin || approvePaymentRole || canEditItems)" class="flex flex-wrap justify-end gap-2 my-3">
                    <Button
                        v-if="!editMode"
                        severity="secondary"
                        class="mr-auto"
                        size="small"
                        variant="text"
                        icon="pi pi-fw pi-print"
                        iconPos="left"
                        label="Накладная"
                        @click="printInvoice"
                    />
                    <Button
                        v-if="!editMode && canEditItems"
                        severity="info"
                        size="small"
                        icon="pi pi-pencil"
                        label="Изменить позиции"
                        @click="enterEditMode"
                    />
                    <Button
                        v-if="editMode"
                        severity="secondary"
                        size="small"
                        variant="text"
                        icon="pi pi-times"
                        label="Отмена"
                        @click="cancelEdit"
                    />
                    <Button
                        v-if="editMode"
                        severity="success"
                        size="small"
                        icon="pi pi-check"
                        label="Сохранить позиции"
                        :loading="isUpdatingOrder"
                        :disabled="isUpdatingOrder"
                        @click="saveEdits"
                    />
                    <Button
                        v-if="!editMode && !order.isCompleted && (orderCreator || (user.isAdmin && user.role.permissions.includes('edit_orders')))"
                        severity="danger"
                        size="small"
                        variant="text"
                        icon="pi pi-times"
                        iconPos="right"
                        label="Отменить заказ"
                        @click="confirmDeleteOrderDialog = true"
                    />
                    <Button
                        v-if="!editMode && !order.confirmedPaid && ((!order.isPaid && canMarkPaid) || (order.isPaid && approvePaymentRole))"
                        size="small"
                        :label="!order.isPaid ? 'Оплатить' : 'Подтвердить оплату'"
                        icon="pi pi-check"
                        severity="success"
                        @click="payDialog = true"
                    />
                    <Button
                        v-if="!editMode && order.isPaid && !order.confirmedPaid && !approvePaymentRole"
                        size="small"
                        label="Оплачено"
                        icon="pi pi-check"
                        severity="success"
                        disabled
                    />
                    <Button
                        v-if="!editMode && order.confirmedPaid && !order.isCompleted && (orderCreator || (user.isAdmin && user.role.permissions.includes('edit_orders')))"
                        size="small"
                        label="Завершить"
                        icon="pi pi-check"
                        :disabled="orderBlocked"
                        v-tooltip.top="orderBlocked ? 'Дефицит по складу — завершение заблокировано до пополнения / корректировки заказов' : ''"
                        @click="finalConfirmedDialog = true"
                    />
                </div>
            </template>
        </DataTable>
        <Message v-if="!editMode && !order.confirmedPaid" class="flex justify-center mt-4" severity="success">{{ msgsData?.paymentMessage }}</Message>
        <Message v-if="!editMode && !order.isCompleted && order.confirmedPaid" class="flex justify-center mt-4" severity="info">{{ msgsData?.receivedMessage }}</Message>
        <Message v-if="!editMode && !order.isCompleted" class="flex justify-center mt-4" severity="secondary">После получения, пожалуйста, завершите заказ.</Message>

        <div v-if="!editMode && order.paymentEvents && order.paymentEvents.length" class="mt-4">
            <Divider type="dashed" />
            <h4 class="font-semibold text-base mb-2">История платёжных событий</h4>
            <div class="flex flex-col gap-2">
                <div v-for="(ev, idx) in order.paymentEvents" :key="idx" class="flex items-start gap-3 py-2 px-3 rounded border border-surface-200 dark:border-surface-700">
                    <Tag :value="paymentEventLabel(ev.type)" :severity="paymentEventSeverity(ev.type)" />
                    <div class="flex-1 min-w-0 text-sm">
                        <div><b>{{ formatTimestamp(ev.at) }}</b></div>
                        <div v-if="ev.note">{{ ev.note }}</div>
                        <div v-if="ev.reason" class="text-surface-500"><i>Причина:</i> {{ ev.reason }}</div>
                    </div>
                </div>
            </div>
        </div>
    </Dialog>
    <Dialog v-model:visible="confirmDeleteOrderDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите отменить текущий заказ?</span>
        </div>
        <template #footer>
            <Button label="Нет" severity="secondary" icon="pi pi-times" text @click="confirmDeleteOrderDialog = false" />
            <Button severity="danger" label="Да" icon="pi pi-check" :loading="isDeletingOrder" :disabled="isDeletingOrder" @click="deleteOrder()" />
        </template>
    </Dialog>
    <Dialog v-model:visible="payDialog" :style="{ maxWidth: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-check-circle !text-3xl text-primary-500" />
            <span>{{ msgsData?.paymentMessage }}</span>
        </div>
        <b v-if="order.isPaid"> Вы уже оплатили этот заказ, ожидайте подтверждения казначеем. </b>
        <template #footer>
            <Button label="Закрыть" severity="secondary" icon="pi pi-times" text @click="payDialog = false" />
            <Button v-if="!order.isPaid && canMarkPaid" label="Оплатил" icon="pi pi-check" :loading="isUpdatingOrder" :disabled="isUpdatingOrder" @click="handleUpdateOrder(true, false, false)" />
            <Button v-if="order.isPaid && approvePaymentRole" label="Подтвердить оплату" icon="pi pi-check" :loading="isUpdatingOrder" :disabled="isUpdatingOrder" @click="handleUpdateOrder(true, true, false)" />
        </template>
    </Dialog>
    <Dialog v-model:visible="finalConfirmedDialog" :style="{ maxWidth: '450px' }" header="Подтвердите" :modal="true">
        <Message v-if="orderBlocked" severity="error" class="mb-3">
            Завершение заблокировано — дефицит по складу. Пополните склад или скорректируйте заказы.
        </Message>
        <span> Вы уверенны что хотите подтвердить получение заказа? </span>
        <template #footer>
            <Button label="Нет" severity="secondary" icon="pi pi-times" text @click="finalConfirmedDialog = false" />
            <Button label="Да" icon="pi pi-check" :loading="isUpdatingOrder" :disabled="isUpdatingOrder || orderBlocked" @click="handleUpdateOrder(true, true, true)" />
        </template>
    </Dialog>
</template>

<style scoped>

.order-edit-add {
    display: grid;
    grid-template-columns: 1fr 110px auto;
    gap: 12px;
    align-items: end;
}
.order-edit-add__field {
    min-width: 0;
}
.order-edit-add__btn {
    min-width: 44px;
    min-height: 44px;
    align-self: end;
    margin-bottom: 2px;
}
@media (max-width: 560px) {
    .order-edit-add {
        grid-template-columns: 1fr auto;
        grid-template-areas:
            "field field"
            "qty btn";
    }
    .order-edit-add__field {
        grid-area: field;
    }
    .order-edit-add__qty {
        grid-area: qty;
    }
    .order-edit-add__btn {
        grid-area: btn;
    }
}
</style>
