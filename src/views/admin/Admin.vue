<script setup>
import { authService } from "@/service/auth/auth.service"
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { onMounted, ref, watchEffect } from "vue"
import RoleDialog from "./RoleDialog.vue"
import UserDialog from "./UserDialog.vue"

const user = ref(JSON.parse(localStorage.getItem("user")))

const roleId = ref(null)
const userId = ref(null)
const isSubscribed = ref(false)
const roleDialog = ref(false)
const userDialog = ref(false)
const enabledExportDatabase = ref(false)

const paymentMessage = ref("")
const receivedMessage = ref("")

const queryClient = useQueryClient()

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

const { data: msgsData, isSuccess: isMsgsSuccess } = useQuery({
    queryKey: ["msgs"],
    queryFn: async () => await axiosInstance.get("/database/msg"),
    select: (data) => data.data || { paymentMessage: "", receiveMessage: "" },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { mutate: updateMessages } = useMutation({
    mutationKey: ["updatePaymentMessage"],
    mutationFn: async () => await axiosInstance.put("/database/msg", { paymentMessage: paymentMessage.value, receivedMessage: receivedMessage.value }),
    onSuccess: (data) => {
        queryClient.setQueryData(["msgs"], data)
        queryClient.invalidateQueries({ queryKey: ["msgs"] })
    }
})

const { data: exportDatabaseData, refetch: refetchExportDatabase } = useQuery({
    queryKey: ["exportDatabase"],
    queryFn: async () => await axiosInstance.get("/database/export"),
    select: (data) => data.data || { paymentMessage: "", receiveMessage: "" },
    enabled: enabledExportDatabase.value,
    staleTime: 1000 * 60 * 60 * 10,
    refetchInterval: 1000 * 60 * 60 * 10
})

const { mutate: importDatabase } = useMutation({
    mutationKey: ["importDatabase"],
    mutationFn: async (data) =>
        await axiosInstance.post("/database/import", data, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        }),
    onSuccess: () => {
        queryClient.refetchQueries()
    }
})
onMounted(async () => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
        subscribeToPush()
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        console.log(subscription)
        isSubscribed.value = !!subscription
    }
})

watchEffect(() => {
    if (isMsgsSuccess) {
        paymentMessage.value = msgsData?.value?.paymentMessage || ""
        receivedMessage.value = msgsData?.value?.receivedMessage || ""
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

function closeUserDialog() {
    userDialog.value = false
    userId.value = {}
}

function openUserDialog(id) {
    userId.value = id
    userDialog.value = true
    console.log(userId.value, userDialog.value)
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
    authService.logout()
    router.go("/auth/login")
}

const subscribeToPush = async () => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.ready
        console.log("Service Worker registered:", registration)
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array("BCAa7eZ76DxCQkNtvjSDqkayT7cHm1EP_Z_FNhx7XWHiYUhgs3YtPA0Z68W8ZbzD3varTZYT_uN5FCP65_lE2Vg")
        })
        await axiosInstance.post("/change-history/subscribe", subscription)
        console.log(subscription)
        window.location.reload()
    } else {
        console.error("Push notifications are not supported in this browser.")
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
    <div v-if="!isSubscribed" class="card">
        <Button label="Подписаться на уведомления" class="p-button-outlined" @click="subscribeToPush" />
    </div>
    <Toolbar v-if="user.role?.permissions?.includes('export-database') || user.role?.permissions?.includes('import-database')" class="mb-6 gap-2">
        <template #start>
            <p class="ml-6"><b>База данных:</b></p>
            <Button v-if="user.role?.permissions?.includes('export-database')" label="Экспорт" icon="pi pi-download" class="mx-4" severity="secondary" @click="exportDatabaseHandler()" />
            <FileUpload v-if="user.role?.permissions?.includes('import-database')" mode="basic" @select="importDatabaseHandler" chooseLabel="Импорт" choose-icon="pi pi-upload" customUpload auto />
        </template>
    </Toolbar>
    <div class="card" v-if="isRolesSuccess">
        <DataTable :value="rolesData" size="small">
            <template #header>
                <div class="flex flex-wrap gap-4 items-center">
                    <b>Роли:</b>
                    <Button v-if="user.role?.permissions?.includes('create_role')" size="small" type="button" icon="pi pi-plus" label="Создать" @click="openRoleDialog(null)" outlined />
                </div>
            </template>
            <Column field="name" header="Название"></Column>
            <Column style="padding: 0.1rem; min-width: 82px">
                <template #body="slotProps">
                    <Button v-if="user.role?.permissions?.includes('view_roles')" size="small" label="Детали" severity="info" icon="pi pi-info-circle" outlined rounded @click="openRoleDialog(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>
    </div>
    <div class="card" v-if="isUsersSuccess">
        <DataTable :value="usersData" size="small">
            <template #header>
                <div class="flex flex-wrap gap-4 items-center">
                    <b>Пользователи:</b>
                    <Button v-if="user.role?.permissions?.includes('create_users')" size="small" type="button" icon="pi pi-plus" label="Создать" outlined @click="openUserDialog(null)" />
                </div>
            </template>
            <Column field="name" header="Название"></Column>
            <Column field="role.name" header="Роль"></Column>
            <Column style="padding: 0.1rem; min-width: 82px">
                <template #body="slotProps">
                    <Button v-if="user.role?.permissions?.includes('view_users')" size="small" label="Детали" severity="info" icon="pi pi-info-circle" outlined rounded @click="openUserDialog(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>
    </div>
    <div class="card" v-if="isMsgsSuccess">
        <FloatLabel variant="on">
            <Textarea :disabled="!user.role?.permissions?.includes('approve-payment')" @blur="updateMessages()" v-model="paymentMessage" rows="5" cols="30" style="resize: none; width: 100%" />
            <label>Оплата</label>
        </FloatLabel>
    </div>
    <div class="card" v-if="isMsgsSuccess">
        <FloatLabel variant="on">
            <Textarea :disabled="!user.role?.permissions?.includes('create_purchases')" @blur="updateMessages()" v-model="receivedMessage" rows="5" cols="30" style="resize: none; width: 100%" />
            <label>Получение</label>
        </FloatLabel>
    </div>

    <RoleDialog v-if="roleDialog" :editable="user.role?.permissions?.includes('edit_roles')" :visible="roleDialog" :usersData="usersData" :roleId="roleId" @closeRoleDialog="closeRoleDialog" />
    <UserDialog v-if="userDialog" :editable="user.role?.permissions?.includes('edit_users')" :visible="userDialog" :rolesData="rolesData" :userId="userId" @closeUserDialog="closeUserDialog" />
</template>
