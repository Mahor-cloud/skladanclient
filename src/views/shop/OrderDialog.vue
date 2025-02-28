<script setup>
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, ref, watchEffect } from "vue"
import { generateInvoice } from "./invoice"
const props = defineProps({
    order: String,
    visible: Boolean
})
const emit = defineEmits(["hideOrderDialog"])

const queryClient = useQueryClient()

const order = ref({})
const visible = ref(props.visible)
const confirmDeleteOrderDialog = ref(false)
const payDialog = ref(false)

const headerMessage = ref("")
const footerMessage = ref("")
const statusMessage = ref("")
const user = ref(JSON.parse(localStorage.getItem("user")))

const { data: msgsData, isSuccess: isMsgsSuccess } = useQuery({
    queryKey: ["msgs"],
    queryFn: async () => await axiosInstance.get("/database/msg"),
    select: (data) => data.data || { paymentMessage: "", receiveMessage: "" },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { data, isSuccess } = useQuery({
    queryKey: ["order", props.order],
    queryFn: async () => await axiosInstance.get(`/orders/${props.order}`),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})
const { mutate: deleteOrder } = useMutation({
    mutationKey: ["deleteOrder", props.order],
    mutationFn: async () => await axiosInstance.delete(`/orders/${props.order}`),
    onSuccess: () => {
        queryClient.setQueryData(["orders", props.order], {})
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })

        emit("hideOrderDialog")
    }
})

const { mutate: updateOrder } = useMutation({
    mutationKey: ["updateOrder", props.order],
    mutationFn: async (data) => await axiosInstance.put(`/orders/${props.order}`, data),
    onSuccess: (data) => {
        queryClient.invalidateQueries(["order", data.data._id], data.value)
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })

        payDialog.value = false
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        order.value = {
            ...data.value,
            items: [
                ...data.value.items.map((item) => ({
                    ...item.product,
                    buyQuantity: item.quantity
                }))
            ]
        }
        headerMessage.value = `Заказ номер ${order.value.orderNumber}, Заказчик: ${order.value.user.name}`
        footerMessage.value = `Итого: ${formatCurrency(order.value.items.reduce((acc, item) => acc + item.price * item.buyQuantity, 0))}`
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
        return user.value?.isAdmin && user.value?.role?.permissions?.includes("approve-payment")
    }
})
function handleUpdateOrder(isPaid, confirmedPaid, isCompleted) {
    updateOrder({
        ...order.value,
        isPaid: isPaid,
        confirmedPaid: confirmedPaid,
        isCompleted: isCompleted,
        items: order.value.items.map((item) => ({
            product: item._id,
            quantity: item.buyQuantity
        }))
    })
}

function formatCurrency(value) {
    if (value) return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return
}
</script>
<template>
    <Dialog :visible="visible" :style="{ width: '90%', height: '100%' }" :modal="true" :header="headerMessage" v-on:update:visible="emit('hideOrderDialog')">
        <DataTable size="small" paginatorPosition="bottom" ref="dt" :value="order.items" dataKey="_id" :rows="30" filterDisplay="menu" show-gridlines>
            <template #header>
                <Message severity="info"><b>Текущий статус:</b> {{ statusMessage }}</Message>
            </template>
            <Column field="name" header="Название" style="max-width: 1.5rem; padding: 0.3rem"></Column>
            <Column header="Заказано" field="buyQuantity" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="max-width: 1rem; padding: 0.3rem"></Column>
            <Column field="price" header="Цена" style="max-width: 0.5rem; padding: 0.3rem">
                <template #body="slotProps">
                    {{ formatCurrency(slotProps.data.price * slotProps.data.buyQuantity) }}
                </template>
            </Column>
            <template #footer>
                <p class="text-right mr-10">
                    <b>{{ footerMessage }}</b>
                </p>

                <div v-if="orderCreator || (user.isAdmin && user.role.permissions.includes('edit_orders'))" class="flex justify-end gap-4 my-3">
                    <Button
                        severity="secondary"
                        class="mr-auto"
                        size="small"
                        variant="text"
                        icon="pi pi-fw pi-print"
                        iconPos="left"
                        label="Накладная"
                        @click="
                            generateInvoice({
                                ...order,
                                totalPrice: footerMessage,
                                orderDate: formatTimestamp(order.orderDate)
                            })
                        "
                    />
                    <Button
                        v-if="!order.isCompleted && (orderCreator || (user.isAdmin && user.role.permissions.includes('edit_orders')))"
                        severity="danger"
                        size="small"
                        variant="text"
                        icon="pi pi-times"
                        iconPos="right"
                        label="Отменить заказ"
                        @click="confirmDeleteOrderDialog = true"
                    />
                    <Button
                        v-if="!order.confirmedPaid && (orderCreator || (user.isAdmin && user.role.permissions.includes('approve-payment')))"
                        size="small"
                        :label="!order.isPaid ? 'Оплатить' : 'Оплачено'"
                        icon="pi pi-check"
                        severity="success"
                        @click="payDialog = true"
                    />
                    <Button
                        v-if="order.confirmedPaid && !order.isCompleted && (orderCreator || (user.isAdmin && user.role.permissions.includes('edit_orders')))"
                        size="small"
                        label="Завершить"
                        icon="pi pi-check"
                        @click="handleUpdateOrder(true, true, true)"
                    />
                </div>
            </template>
        </DataTable>
        <Message v-if="!order.confirmedPaid" class="flex justify-center mt-4" severity="success">{{ msgsData?.paymentMessage }}</Message>
        <Message v-if="!order.isCompleted && order.confirmedPaid" class="flex justify-center mt-4" severity="info">{{ msgsData?.receivedMessage }}</Message>
        <Message v-if="!order.isCompleted" class="flex justify-center mt-4" severity="secondary">После получения, пожалуйста, завершите заказ.</Message>
    </Dialog>
    <Dialog v-model:visible="confirmDeleteOrderDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите отменить текущий заказ?</span>
        </div>
        <template #footer>
            <Button label="Нет" severity="secondary" icon="pi pi-times" text @click="confirmDeleteOrderDialog = false" />
            <Button severity="danger" label="Да" icon="pi pi-check" @click="deleteOrder()" />
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
            <Button v-if="!order.isPaid" label="Оплатил" icon="pi pi-check" @click="handleUpdateOrder(true, false, false)" />
            <Button v-if="order.isPaid && approvePaymentRole" label="Подтвердить оплату" icon="pi pi-check" @click="handleUpdateOrder(true, true, false)" />
        </template>
    </Dialog>
</template>
