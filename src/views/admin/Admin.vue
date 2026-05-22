<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCurrentUser } from "@/composables/useCurrentUser"
import router from "@/router"
import { authService } from "@/service/auth/auth.service"
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, onMounted, ref, watchEffect } from "vue"
import RoleDialog from "./RoleDialog.vue"
import UserDialog from "./UserDialog.vue"

const user = useCurrentUser()
const toast = useToast()

const roleId = ref(null)
const userId = ref(null)
const isSubscribed = ref(false)
const roleDialog = ref(false)
const userDialog = ref(false)
const enabledExportDatabase = ref(false)

const paymentMessage = ref("")
const receivedMessage = ref("")
const targetWarehouseValue = ref(0)

const subscriptionCategories = [
    { key: "orders", label: "Заказы", help: "Push при создании, изменении и удалении заказов компании — смена статуса заказа (оплачен → подтверждён казначеем → завершён), правка позиций, отмена. По умолчанию приходят события по ВСЕМ заказам компании; ниже можно ограничить только своими." },
    { key: "purchases", label: "Закупки", help: "Push при создании, изменении и удалении закупок: оформление, оплата казначеем, проведение получения, частичное/полное завершение." },
    { key: "inventory", label: "Инвентаризации", help: "Push при запуске новой инвентаризации, её изменении и завершении (а также удалении/перезаписи завершённой)." },
    { key: "products", label: "Товары", help: "Push при создании, изменении и удалении товаров каталога (цена, категория, остатки и т.д.)." },
    { key: "users", label: "Пользователи", help: "Push при создании, изменении и удалении пользователей компании." },
    { key: "roles", label: "Роли", help: "Push при создании, изменении и удалении ролей и их прав." },
    { key: "payment", label: "Доплата / возврат", help: "Push «Требуется доплата» или «Требуется возврат» по заказам, где сумма изменилась после оплаты (правка позиций оплаченного/завершённого заказа). Полезно казначею и наблюдателям." }
]

const ordersOwnOnlyHelp =
    "Если включено — по категории «Заказы» приходят уведомления только о ВАШИХ заказах (где вы заказчик), а не обо всех заказах компании. Удобно представителю: видеть смену статуса именно своих заказов. На другие категории не влияет."
const subscriptionPreferences = ref({
    orders: true,
    purchases: true,
    inventory: true,
    products: true,
    users: true,
    roles: true,
    payment: true,
    ordersOwnOnly: false
})

const subHelpDialog = ref(false)
const subHelpItem = ref(null)
function openSubHelp(item) {
    subHelpItem.value = item
    subHelpDialog.value = true
}
const isPushSupported = ref(typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window)
const isSubscribePending = ref(false)
const isSavePrefsPending = ref(false)

const queryClient = useQueryClient()

const adminSkeletonRows = Array.from({ length: 5 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))

const { data: rolesData, isSuccess: isRolesSuccess } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => await axiosInstance.get("/roles"),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { data: usersData, isSuccess: isUsersSuccess } = useQuery({
    queryKey: ["users"],
    queryFn: async () => await axiosInstance.get("/auth/users"),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const canViewMessages = computed(() => !!user.value?.role?.permissions?.includes("view-messages"))

const { data: msgsData, isSuccess: isMsgsSuccess } = useQuery({
    queryKey: ["msgs"],
    queryFn: async () => await axiosInstance.get("/database/msg"),
    select: (data) => data.data || { paymentMessage: "", receiveMessage: "" },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    enabled: canViewMessages
})

const { mutate: updatePaymentMessage } = useMutation({
    mutationKey: ["updatePaymentMessage"],
    mutationFn: async () => await axiosInstance.put("/database/msg/payment", { paymentMessage: paymentMessage.value }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["msgs"] })
        toast.add({ severity: "success", summary: "Сообщение об оплате сохранено", life: 2000 })
    },
    onError: (error) => {
        toast.add({ severity: "error", summary: "Ошибка", detail: error?.response?.data?.message || "Нет прав на изменение сообщения об оплате", life: 4000 })
    }
})

const { mutate: updateReceivedMessage } = useMutation({
    mutationKey: ["updateReceivedMessage"],
    mutationFn: async () => await axiosInstance.put("/database/msg/received", { receivedMessage: receivedMessage.value }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["msgs"] })
        toast.add({ severity: "success", summary: "Сообщение о получении сохранено", life: 2000 })
    },
    onError: (error) => {
        toast.add({ severity: "error", summary: "Ошибка", detail: error?.response?.data?.message || "Нет прав на изменение сообщения о получении", life: 4000 })
    }
})

const { mutate: updateTargetWarehouseValue, isPending: isSavingTarget } = useMutation({
    mutationKey: ["updateTargetWarehouseValue"],
    mutationFn: async () =>
        await axiosInstance.put("/database/msg/target-warehouse-value", {
            targetWarehouseValue: Number(targetWarehouseValue.value) || 0
        }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["msgs"] })
    }
})

const { data: exportDatabaseData, refetch: refetchExportDatabase } = useQuery({
    queryKey: ["exportDatabase"],
    queryFn: async () => await axiosInstance.get("/database/export/company"),
    select: (data) => data.data || { paymentMessage: "", receiveMessage: "" },
    enabled: enabledExportDatabase.value,
    staleTime: 1000 * 60 * 60 * 10,
    refetchInterval: 1000 * 60 * 60 * 10
})

const { mutate: importDatabase } = useMutation({
    mutationKey: ["importDatabase"],
    mutationFn: async (data) =>
        await axiosInstance.post("/database/import/company", data, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        }),
    onSuccess: () => {
        authService.logout()
        window.location.href = window.location.origin + "/#/auth/login"
    },
    onError: (error) => {
        console.error("Error importing database:", error)
    }
})

async function refreshSubscriptionState() {
    if (!isPushSupported.value) return
    try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration) {
            isSubscribed.value = false
            return
        }
        const swSub = await registration.pushManager.getSubscription()
        isSubscribed.value = !!swSub
        if (swSub) {
            const r = await axiosInstance.get("/change-history/subscription/me")
            const remotePrefs = r.data?.preferences
            if (remotePrefs) {
                subscriptionPreferences.value = {
                    ...subscriptionPreferences.value,
                    ...remotePrefs
                }
            }
        }
    } catch (error) {
        console.error("Error checking subscription:", error)
    }
}

onMounted(async () => {
    await refreshSubscriptionState()
})

watchEffect(() => {
    if (isMsgsSuccess) {
        paymentMessage.value = msgsData?.value?.paymentMessage || ""
        receivedMessage.value = msgsData?.value?.receivedMessage || ""
        targetWarehouseValue.value = Number(msgsData?.value?.targetWarehouseValue) || 0
    }
})

function closeRoleDialog() {
    roleDialog.value = false
    roleId.value = {}
}

function openRoleDialog(id) {
    roleId.value = id
    roleDialog.value = true
}

const roleInfoDialog = ref(false)
const roleInfoData = ref(null)
const permActionText = {
    view_users: "видеть список пользователей",
    create_users: "создавать пользователей",
    edit_users: "редактировать пользователей",
    delete_users: "удалять пользователей",
    view_roles: "видеть роли",
    create_role: "создавать роли",
    edit_roles: "редактировать роли",
    delete_roles: "удалять роли",
    create_change_history: "создавать записи в истории",
    view_change_history: "смотреть историю изменений",
    view_inventory: "видеть инвентаризации",
    create_inventory: "создавать инвентаризацию",
    edit_inventory: "редактировать инвентаризацию",
    delete_inventory: "удалять инвентаризацию",
    view_orders: "видеть заказы",
    create_orders: "создавать заказы",
    edit_orders: "редактировать позиции заказов",
    delete_orders: "удалять/отменять заказы",
    "approve-payment": "подтверждать оплату заказов и оплачивать закупки (без права менять позиции)",
    approve_target_exceed: "подтверждать заказ сверх цели",
    view_purchases: "видеть закупки",
    create_purchases: "создавать закупки",
    edit_purchases: "редактировать позиции закупок",
    delete_purchases: "удалять закупки",
    view_products: "видеть товары",
    create_product: "создавать товары",
    edit_products: "редактировать товары",
    delete_products: "удалять товары",
    cabinet_access: "пользоваться личным складом",
    view_all_cabinets: "видеть личные склады других",
    view_cabinet_summary: "видеть сводку по личным складам",
    view_statistics: "смотреть статистику",
    export_statistics: "выгружать статистику в файл",
    "view-messages": "видеть сообщения об оплате/получении",
    "edit-payment-message": "менять сообщение об оплате",
    "edit-received-message": "менять сообщение о получении",
    "export-database": "выгружать базу данных",
    "import-database": "загружать базу данных"
}
const roleInfoLines = computed(() => {
    const perms = roleInfoData.value?.permissions || []
    const lines = perms.map((p) => permActionText[p]).filter(Boolean)
    return lines.length ? lines : ["нет назначенных прав"]
})
function openRoleInfo(role) {
    roleInfoData.value = role
    roleInfoDialog.value = true
}

function closeUserDialog() {
    userDialog.value = false
    userId.value = {}
}

function openUserDialog(id) {
    userId.value = id
    userDialog.value = true
}

async function exportDatabaseHandler() {
    enabledExportDatabase.value = true
    try {
        await refetchExportDatabase()
        if (exportDatabaseData.value) {
            const blob = new Blob([JSON.stringify(exportDatabaseData.value, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "db.json"
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }
    } catch (err) {
        console.error("Error exporting data:", err)
    }
}

function importDatabaseHandler(e) {
    const file = e.files[0]
    const formData = new FormData()
    formData.append("file", file)
    importDatabase(formData)
}

const subscribeToPush = async () => {
    if (!isPushSupported.value) {
        toast.add({ severity: "warn", summary: "Не поддерживается", detail: "Браузер не поддерживает push-уведомления.", life: 5000 })
        return
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        toast.add({ severity: "warn", summary: "Заблокировано", detail: "Уведомления отключены в настройках браузера. Разрешите их и попробуйте снова.", life: 6000 })
        return
    }
    isSubscribePending.value = true
    try {

        if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
            const perm = await Notification.requestPermission()
            if (perm !== "granted") {
                toast.add({ severity: "warn", summary: "Без разрешения", detail: "Без разрешения на уведомления подписка невозможна.", life: 5000 })
                return
            }
        }

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        if (!vapidKey) {
            toast.add({ severity: "error", summary: "Ошибка конфигурации", detail: "VAPID_PUBLIC_KEY не настроен на клиенте.", life: 6000 })
            return
        }

        let registration = await navigator.serviceWorker.getRegistration()
        if (!registration) {
            try {
                registration = await navigator.serviceWorker.register("/service-worker.js")
            } catch (e) {
                throw new Error("Не удалось зарегистрировать Service Worker: " + (e?.message || e))
            }
        }

        const readyPromise = navigator.serviceWorker.ready
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Service Worker не активирован за 10 сек")), 10000)
        )
        registration = await Promise.race([readyPromise, timeoutPromise])

        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            })
        }
        const subJson = subscription.toJSON()
        await axiosInstance.post("/change-history/subscribe", {
            ...subJson,
            preferences: subscriptionPreferences.value
        })
        isSubscribed.value = true
        toast.add({ severity: "success", summary: "Подписка активна", life: 3000 })
    } catch (error) {
        const detail = error?.response?.data?.message || error?.message || "Не удалось подписаться на уведомления"
        toast.add({ severity: "error", summary: "Ошибка подписки", detail, life: 6000 })
        console.error("Error subscribing to push notifications:", error)
    } finally {
        isSubscribePending.value = false
    }
}

const savePreferences = async () => {
    isSavePrefsPending.value = true
    try {
        await axiosInstance.put("/change-history/subscription/preferences", subscriptionPreferences.value)

        await subscribeToPush()
        toast.add({ severity: "success", summary: "Настройки сохранены и подписка обновлена", life: 2500 })
    } catch (error) {
        toast.add({ severity: "error", summary: "Ошибка", detail: error?.response?.data?.message || error?.message || "Не удалось сохранить настройки", life: 4000 })
    } finally {
        isSavePrefsPending.value = false
    }
}

const refreshSubscription = async () => {
    if (!isPushSupported.value) return
    isSubscribePending.value = true
    try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
            const existing = await registration.pushManager.getSubscription()
            if (existing) await existing.unsubscribe()
        }
        await subscribeToPush()
    } catch (error) {
        console.error("Error refreshing subscription:", error)
        toast.add({ severity: "error", summary: "Ошибка", detail: error?.message || "Не удалось обновить подписку", life: 5000 })
    } finally {
        isSubscribePending.value = false
    }
}

const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}
</script>
<template>
    <div class="card">
        <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                    <i class="pi pi-bell text-xl" />
                    <b>Push-уведомления</b>
                    <Tag v-if="isSubscribed" severity="success" value="Подписка активна" />
                    <Tag v-else severity="warn" value="Не подписан" />
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button v-if="!isSubscribed" :loading="isSubscribePending" icon="pi pi-bell" label="Подписаться на уведомления" @click="subscribeToPush" />
                    <Button v-if="isSubscribed" :loading="isSavePrefsPending" icon="pi pi-check" label="Сохранить настройки" severity="success" @click="savePreferences" />
                    <Button v-if="isSubscribed" :loading="isSubscribePending" icon="pi pi-refresh" label="Обновить подписку" severity="secondary" @click="refreshSubscription" />
                </div>
            </div>
            <small class="text-muted-color">Выберите типы событий, на которые хотите получать push-уведомления. Категория «Доплата / возврат» приходит только пользователям с правом подтверждения оплаты.</small>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                <label v-for="cat in subscriptionCategories" :key="cat.key" class="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800">
                    <Checkbox v-model="subscriptionPreferences[cat.key]" :binary="true" />
                    <span>{{ cat.label }}</span>
                    <Button
                        type="button"
                        severity="help"
                        size="small"
                        text
                        rounded
                        icon="pi pi-question-circle"
                        class="ml-auto"
                        :aria-label="`Что даёт подписка «${cat.label}»`"
                        v-tooltip.top="'Что даёт эта подписка'"
                        @click.stop.prevent="openSubHelp(cat)"
                    />
                </label>
            </div>
            <label class="flex items-center gap-2 cursor-pointer select-none px-3 py-2 mt-2 rounded border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800">
                <Checkbox v-model="subscriptionPreferences.ordersOwnOnly" :binary="true" :disabled="subscriptionPreferences.orders === false" />
                <span>Только мои заказы</span>
                <Button
                    type="button"
                    severity="help"
                    size="small"
                    text
                    rounded
                    icon="pi pi-question-circle"
                    class="ml-auto"
                    aria-label="Что даёт «Только мои заказы»"
                    v-tooltip.top="'Что даёт эта опция'"
                    @click.stop.prevent="openSubHelp({ label: 'Только мои заказы', help: ordersOwnOnlyHelp })"
                />
            </label>
            <small v-if="!isPushSupported" class="text-red-500">Браузер не поддерживает push-уведомления.</small>
        </div>
    </div>
    <Dialog v-model:visible="subHelpDialog" :style="{ width: '95%', maxWidth: '460px' }" :breakpoints="{ '768px': '100vw' }" :header="subHelpItem ? subHelpItem.label : 'Подписка'" :modal="true" :draggable="false">
        <p style="line-height: 1.5">{{ subHelpItem ? subHelpItem.help : '' }}</p>
        <template #footer>
            <Button label="Понятно" icon="pi pi-check" @click="subHelpDialog = false" />
        </template>
    </Dialog>
    <Toolbar v-if="user.role?.permissions?.includes('export-database') || user.role?.permissions?.includes('import-database')" class="mb-6 gap-2">
        <template #start>
            <p class="ml-6"><b>База данных:</b></p>
            <Button v-if="user.role?.permissions?.includes('export-database')" label="Экспорт" icon="pi pi-download" class="mx-4" severity="secondary" @click="exportDatabaseHandler()" />
            <FileUpload v-if="user.role?.permissions?.includes('import-database')" mode="basic" @select="importDatabaseHandler" chooseLabel="Импорт" choose-icon="pi pi-upload" customUpload auto />
        </template>
    </Toolbar>
    <div class="card">
        <DataTable
            :value="isRolesSuccess ? rolesData : adminSkeletonRows"
            size="small"
            :loading="!isRolesSuccess"
            data-key="_id"
        >
            <template #header>
                <div class="flex flex-wrap gap-4 items-center">
                    <b>Роли:</b>
                    <Button v-if="user.role?.permissions?.includes('create_role')" size="small" type="button" icon="pi pi-plus" label="Создать" @click="openRoleDialog(null)" outlined />
                </div>
            </template>
            <Column field="name" header="Название">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="40%" height="1rem" />
                    <span v-else>{{ slotProps.data.name }}</span>
                </template>
            </Column>
            <Column style="padding: 0.1rem; min-width: 110px">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="6rem" height="2rem" border-radius="999px" />
                    <div v-else class="flex items-center gap-2">
                        <Button
                            severity="help"
                            size="small"
                            icon="pi pi-question-circle"
                            outlined
                            rounded
                            aria-label="Что даёт эта роль"
                            v-tooltip.top="'Что даёт эта роль'"
                            @click="openRoleInfo(slotProps.data)"
                        />
                        <Button v-if="user.role?.permissions?.includes('view_roles')" size="small" label="Детали" severity="info" icon="pi pi-cog" outlined rounded @click="openRoleDialog(slotProps.data._id)" />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>
    <div class="card">
        <DataTable
            :value="isUsersSuccess ? usersData : adminSkeletonRows"
            size="small"
            :loading="!isUsersSuccess"
            data-key="_id"
        >
            <template #header>
                <div class="flex flex-wrap gap-4 items-center">
                    <b>Пользователи:</b>
                    <Button v-if="user.role?.permissions?.includes('create_users')" size="small" type="button" icon="pi pi-plus" label="Создать" outlined @click="openUserDialog(null)" />
                </div>
            </template>
            <Column field="name" header="Название">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="50%" height="1rem" />
                    <span v-else>{{ slotProps.data.name }}</span>
                </template>
            </Column>
            <Column field="role.name" header="Роль">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="40%" height="1rem" />
                    <span v-else>{{ slotProps.data.role?.name }}</span>
                </template>
            </Column>
            <Column style="padding: 0.1rem; min-width: 82px">
                <template #body="slotProps">
                    <Skeleton v-if="slotProps.data._skeleton" width="5rem" height="2rem" border-radius="999px" />
                    <Button v-else-if="user.role?.permissions?.includes('view_users')" size="small" label="Детали" severity="info" icon="pi pi-info-circle" outlined rounded @click="openUserDialog(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>
    </div>
    <div class="card">
        <Skeleton v-if="!isMsgsSuccess" width="100%" height="6rem" />
        <FloatLabel v-else variant="on">
            <Textarea :disabled="!(user.isAdmin || user.role?.permissions?.includes('edit-payment-message'))" @blur="updatePaymentMessage()" v-model="paymentMessage" rows="5" cols="30" style="resize: none; width: 100%" />
            <label>Оплата</label>
        </FloatLabel>
    </div>
    <div class="card">
        <Skeleton v-if="!isMsgsSuccess" width="100%" height="6rem" />
        <FloatLabel v-else variant="on">
            <Textarea :disabled="!(user.isAdmin || user.role?.permissions?.includes('edit-received-message'))" @blur="updateReceivedMessage()" v-model="receivedMessage" rows="5" cols="30" style="resize: none; width: 100%" />
            <label>Получение</label>
        </FloatLabel>
    </div>
    <div v-if="user.isAdmin" class="card">
        <div class="flex items-center gap-3">
            <b>Целевая сумма склада:</b>
            <InputNumber
                v-model="targetWarehouseValue"
                @blur="updateTargetWarehouseValue()"
                :min="0"
                mode="currency"
                currency="RUB"
                :minFractionDigits="0"
                :maxFractionDigits="0"
                :useGrouping="true"
                :inputStyle="{ width: '180px' }"
                :loading="isSavingTarget"
            />
            <small class="text-muted-color">Справочно — отображается на главной странице.</small>
        </div>
    </div>

    <Dialog v-model:visible="roleInfoDialog" :style="{ width: '95%', maxWidth: '460px' }" :breakpoints="{ '768px': '100vw' }" :header="`Роль: ${roleInfoData?.name || ''}`" :modal="true" :draggable="false">
        <p class="mb-3">Пользователь с этой ролью может:</p>
        <ul style="list-style: disc; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 6px">
            <li v-for="(line, i) in roleInfoLines" :key="i" style="line-height: 1.35">{{ line }}</li>
        </ul>
        <template #footer>
            <Button label="Понятно" icon="pi pi-check" @click="roleInfoDialog = false" />
        </template>
    </Dialog>

    <RoleDialog v-if="roleDialog" :editable="user.role?.permissions?.includes('edit_roles')" :visible="roleDialog" :usersData="usersData" :roleId="roleId" @closeRoleDialog="closeRoleDialog" />
    <UserDialog v-if="userDialog" :editable="user.role?.permissions?.includes('edit_users')" :visible="userDialog" :rolesData="rolesData" :userId="userId" @closeUserDialog="closeUserDialog" />
</template>
